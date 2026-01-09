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

/**
 * Check if a version string is a canary/pre-release version.
 */
export function isCanaryVersion(version: string): boolean {
  return version.includes("-canary") || version.includes("-rc");
}

/**
 * Get the raw GitHub URL for a file in the Next.js repo.
 */
export function getRawGitHubUrl(tag: string, path: string): string {
  return `https://raw.githubusercontent.com/vercel/next.js/${tag}/${path}`;
}

/**
 * Get the GitHub API URL for a directory in the Next.js repo.
 */
export function getGitHubApiUrl(tag: string, path: string): string {
  return `https://api.github.com/repos/vercel/next.js/contents/${path}?ref=${tag}`;
}
