/**
 * Convert a Next.js version string to a GitHub release tag.
 *
 * Examples:
 * - "16.1.1" → "v16.1.1"
 * - "16.1.0-canary.5" → "v16.1.0-canary.5"
 */
export function versionToGitHubTag(version: string): string {
  // If already has 'v' prefix, return as-is
  if (version.startsWith("v")) {
    return version;
  }
  return `v${version}`;
}
