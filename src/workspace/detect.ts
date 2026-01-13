import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type WorkspaceType = "pnpm" | "npm" | "yarn" | "nx" | "lerna" | null;

export interface WorkspaceInfo {
  isMonorepo: boolean;
  type: WorkspaceType;
  packages: string[];
}

/**
 * Detect if the project is a monorepo and return workspace info.
 * Checks for pnpm, npm/yarn, nx, and lerna workspaces.
 */
export function detectWorkspace(cwd: string): WorkspaceInfo {
  // Check pnpm workspaces (pnpm-workspace.yaml)
  const pnpmWorkspacePath = join(cwd, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    const packages = parsePnpmWorkspace(pnpmWorkspacePath);
    if (packages.length > 0) {
      return { isMonorepo: true, type: "pnpm", packages };
    }
  }

  // Check npm/yarn workspaces (package.json workspaces field)
  const packageJsonPath = join(cwd, "package.json");
  if (existsSync(packageJsonPath)) {
    const packages = parsePackageJsonWorkspaces(packageJsonPath);
    if (packages.length > 0) {
      // Could be npm or yarn - doesn't matter for our purposes
      return { isMonorepo: true, type: "npm", packages };
    }
  }

  // Check Lerna (lerna.json)
  const lernaPath = join(cwd, "lerna.json");
  if (existsSync(lernaPath)) {
    const packages = parseLernaConfig(lernaPath);
    if (packages.length > 0) {
      return { isMonorepo: true, type: "lerna", packages };
    }
  }

  // Check Nx (nx.json) - Nx uses package.json workspaces or project.json files
  const nxPath = join(cwd, "nx.json");
  if (existsSync(nxPath)) {
    // Nx typically uses package.json workspaces or has projects in apps/ and libs/
    const packages = parseNxWorkspace(cwd, packageJsonPath);
    if (packages.length > 0) {
      return { isMonorepo: true, type: "nx", packages };
    }
  }

  return { isMonorepo: false, type: null, packages: [] };
}

function parsePnpmWorkspace(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Simple YAML parsing for packages array
    // Format: packages:\n  - 'apps/*'\n  - 'packages/*'
    const lines = content.split("\n");
    const packages: string[] = [];
    let inPackages = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "packages:") {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        // Stop if we hit another top-level key
        if (trimmed && !trimmed.startsWith("-") && !trimmed.startsWith("#")) {
          break;
        }
        // Parse package pattern
        const match = trimmed.match(/^-\s*['"]?([^'"]+)['"]?$/);
        if (match) {
          packages.push(match[1]);
        }
      }
    }
    return packages;
  } catch {
    return [];
  }
}

function parsePackageJsonWorkspaces(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const pkg = JSON.parse(content);

    // workspaces can be an array or an object with packages property
    if (Array.isArray(pkg.workspaces)) {
      return pkg.workspaces;
    }
    if (pkg.workspaces?.packages && Array.isArray(pkg.workspaces.packages)) {
      return pkg.workspaces.packages;
    }
    return [];
  } catch {
    return [];
  }
}

function parseLernaConfig(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const config = JSON.parse(content);

    if (Array.isArray(config.packages)) {
      return config.packages;
    }
    // Default Lerna packages location
    return ["packages/*"];
  } catch {
    return [];
  }
}

function parseNxWorkspace(cwd: string, packageJsonPath: string): string[] {
  // Nx typically uses package.json workspaces
  if (existsSync(packageJsonPath)) {
    const packages = parsePackageJsonWorkspaces(packageJsonPath);
    if (packages.length > 0) {
      return packages;
    }
  }
  // Fallback: common Nx project locations
  const defaultPatterns = ["apps/*", "libs/*", "packages/*"];
  const existingPatterns: string[] = [];

  for (const pattern of defaultPatterns) {
    const basePath = join(cwd, pattern.replace("/*", ""));
    if (existsSync(basePath)) {
      existingPatterns.push(pattern);
    }
  }

  return existingPatterns;
}
