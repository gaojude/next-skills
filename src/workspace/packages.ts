import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface NextjsPackage {
  name: string;
  path: string;
  version: string;
}

export interface WorkspaceNextjsResult {
  packages: NextjsPackage[];
  highestVersion: string | null;
  count: number;
}

/**
 * Find all packages in the workspace that have Next.js installed.
 */
export function findNextjsPackages(
  cwd: string,
  patterns: string[]
): WorkspaceNextjsResult {
  const packagePaths = expandWorkspacePatterns(cwd, patterns);
  const nextjsPackages: NextjsPackage[] = [];

  for (const pkgPath of packagePaths) {
    const packageJsonPath = join(pkgPath, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    try {
      const content = readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next;

      if (nextVersion) {
        const cleanVersion = nextVersion.replace(/^[\^~>=<]+/, "");
        nextjsPackages.push({
          name: pkg.name || relative(cwd, pkgPath),
          path: relative(cwd, pkgPath),
          version: cleanVersion,
        });
      }
    } catch {
      // Skip packages with invalid package.json
    }
  }

  const highestVersion = findHighestVersion(nextjsPackages.map((p) => p.version));

  return {
    packages: nextjsPackages,
    highestVersion,
    count: nextjsPackages.length,
  };
}

/**
 * Expand workspace glob patterns to actual package directories.
 */
function expandWorkspacePatterns(cwd: string, patterns: string[]): string[] {
  const packagePaths: string[] = [];

  for (const pattern of patterns) {
    // Skip negation patterns
    if (pattern.startsWith("!")) continue;

    // Handle glob patterns like "apps/*" or "packages/**"
    if (pattern.includes("*")) {
      const expanded = expandGlobPattern(cwd, pattern);
      packagePaths.push(...expanded);
    } else {
      // Direct path
      const fullPath = join(cwd, pattern);
      if (existsSync(fullPath)) {
        packagePaths.push(fullPath);
      }
    }
  }

  return [...new Set(packagePaths)]; // Dedupe
}

/**
 * Simple glob expansion for workspace patterns.
 * Supports: "foo/*", "foo/**", "foo/bar/*"
 */
function expandGlobPattern(cwd: string, pattern: string): string[] {
  const parts = pattern.split("/");
  const results: string[] = [];

  function walk(currentPath: string, partIndex: number): void {
    if (partIndex >= parts.length) {
      // Check if this is a valid package (has package.json)
      if (existsSync(join(currentPath, "package.json"))) {
        results.push(currentPath);
      }
      return;
    }

    const part = parts[partIndex];

    if (part === "*") {
      // Match all direct subdirectories
      if (!existsSync(currentPath)) return;
      try {
        const entries = readdirSync(currentPath);
        for (const entry of entries) {
          const fullPath = join(currentPath, entry);
          if (isDirectory(fullPath)) {
            // For single *, we go to the directory and continue with next parts
            if (partIndex === parts.length - 1) {
              // Last part, check for package.json
              if (existsSync(join(fullPath, "package.json"))) {
                results.push(fullPath);
              }
            } else {
              walk(fullPath, partIndex + 1);
            }
          }
        }
      } catch {
        // Permission denied or other error
      }
    } else if (part === "**") {
      // Match all subdirectories recursively
      walkRecursive(currentPath, results);
    } else {
      // Literal path segment
      const nextPath = join(currentPath, part);
      walk(nextPath, partIndex + 1);
    }
  }

  walk(cwd, 0);
  return results;
}

function walkRecursive(dir: string, results: string[]): void {
  if (!existsSync(dir)) return;

  // Check if this directory has a package.json
  if (existsSync(join(dir, "package.json"))) {
    results.push(dir);
  }

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const fullPath = join(dir, entry);
      if (isDirectory(fullPath)) {
        walkRecursive(fullPath, results);
      }
    }
  } catch {
    // Permission denied or other error
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find the highest semantic version from a list of versions.
 */
function findHighestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  if (versions.length === 1) return versions[0];

  return versions.reduce((highest, current) => {
    return compareVersions(current, highest) > 0 ? current : highest;
  });
}

/**
 * Compare two semantic versions.
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  // Extract numeric parts, ignoring pre-release tags for comparison
  const parseVersion = (v: string) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  };

  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}
