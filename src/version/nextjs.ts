import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface NextjsVersionResult {
  version: string | null;
  error?: string;
}

/**
 * Read the Next.js version from the project's package.json
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

    if (!nextVersion) {
      return {
        version: null,
        error:
          "Next.js is not installed in this project. Add it with: npm install next",
      };
    }

    // Remove any semver prefixes (^, ~, >=, etc.)
    const cleanVersion = nextVersion.replace(/^[\^~>=<]+/, "");

    return { version: cleanVersion };
  } catch (err) {
    return {
      version: null,
      error: `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
