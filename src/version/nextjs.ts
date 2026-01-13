import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { detectWorkspace, type WorkspaceType } from "../workspace/index.js";
import { findNextjsPackages, type NextjsPackage } from "../workspace/index.js";

export interface NextjsVersionResult {
  version: string | null;
  error?: string;
  /** Set when version was found in workspace packages */
  fromWorkspace?: {
    type: WorkspaceType;
    packageCount: number;
    packages: NextjsPackage[];
  };
}

/**
 * Read the Next.js version from the project's package.json.
 * Falls back to searching workspace packages if not found at root.
 */
export function getNextjsVersion(cwd: string): NextjsVersionResult {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    return {
      version: null,
      error: "No package.json found in the current directory",
    };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const nextVersion = dependencies.next || devDependencies.next;

    if (nextVersion) {
      // Found at root - existing behavior
      const cleanVersion = nextVersion.replace(/^[\^~>=<]+/, "");
      return { version: cleanVersion };
    }

    // Not found at root - check for monorepo workspace
    const workspace = detectWorkspace(cwd);
    if (workspace.isMonorepo && workspace.packages.length > 0) {
      const result = findNextjsPackages(cwd, workspace.packages);

      if (result.highestVersion) {
        return {
          version: result.highestVersion,
          fromWorkspace: {
            type: workspace.type,
            packageCount: result.count,
            packages: result.packages,
          },
        };
      }

      // Monorepo but no Next.js found in any package
      return {
        version: null,
        error: `No Next.js found in ${workspace.type} workspace packages. Install it in one of your apps.`,
      };
    }

    // Not a monorepo and no Next.js at root
    return {
      version: null,
      error:
        "Next.js is not installed in this project. Add it with: npm install next",
    };
  } catch (err) {
    return {
      version: null,
      error: `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
