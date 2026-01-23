export interface ClaudeMdIndexData {
  docsPath: string;
  files: { relativePath: string }[];
  githubDocsUrl?: string;
}

/**
 * Generate the documentation index content for CLAUDE.md injection.
 * This creates a compact, single-line index for the pulled docs (optimized for AI agents).
 */
export function generateClaudeMdIndex(data: ClaudeMdIndexData): string {
  const { docsPath, files, githubDocsUrl } = data;

  const parts: string[] = [];

  // Preamble
  parts.push("[Next.js Docs Index]");
  parts.push(`root: ${docsPath}`);
  if (githubDocsUrl) {
    parts.push(`github: ${githubDocsUrl}`);
  }
  parts.push("IMPORTANT: Read .mdx files before writing Next.js code - APIs may have changed.");
  parts.push(`If docs missing run: npx @judegao/next-agents-md`);

  // Compact file listing: dir/:{file1,file2,file3}
  const groupedFiles = groupFilesByDirectory(files);
  for (const group of groupedFiles) {
    const dirLabel = group.dir === "." ? "(root)" : group.dir;
    parts.push(`${dirLabel}:{${group.files.join(",")}}`);
  }

  return parts.join("|");
}

/**
 * Group doc files by their parent directory.
 */
function groupFilesByDirectory(
  files: { relativePath: string }[]
): { dir: string; files: string[] }[] {
  const byDir = new Map<string, string[]>();

  for (const file of files) {
    const normalizedPath = file.relativePath.replace(/\\/g, "/");
    const lastSlash = normalizedPath.lastIndexOf("/");
    const dir = lastSlash === -1 ? "." : normalizedPath.slice(0, lastSlash);
    const name =
      lastSlash === -1
        ? normalizedPath
        : normalizedPath.slice(lastSlash + 1);

    const existing = byDir.get(dir);
    if (existing) {
      existing.push(name);
    } else {
      byDir.set(dir, [name]);
    }
  }

  return Array.from(byDir.entries()).map(([dir, files]) => ({
    dir,
    files,
  }));
}

/**
 * Wrap the index content with markers for easy identification and replacement.
 * Single line format for compact agent consumption.
 */
export function wrapWithMarkers(content: string): string {
  const START_MARKER = "<!-- NEXT-AGENTS-MD-START -->";
  const END_MARKER = "<!-- NEXT-AGENTS-MD-END -->";

  return `${START_MARKER}${content}${END_MARKER}`;
}

/**
 * Check if CLAUDE.md already has our markers.
 */
export function hasExistingIndex(claudeMdContent: string): boolean {
  return claudeMdContent.includes("<!-- NEXT-AGENTS-MD-START -->");
}

/**
 * Replace existing index or append new one.
 */
export function injectIntoClaudeMd(
  claudeMdContent: string,
  indexContent: string
): string {
  const START_MARKER = "<!-- NEXT-AGENTS-MD-START -->";
  const END_MARKER = "<!-- NEXT-AGENTS-MD-END -->";
  const wrappedContent = wrapWithMarkers(indexContent);

  if (hasExistingIndex(claudeMdContent)) {
    // Replace existing content between markers
    const startIdx = claudeMdContent.indexOf(START_MARKER);
    const endIdx = claudeMdContent.indexOf(END_MARKER) + END_MARKER.length;

    return (
      claudeMdContent.slice(0, startIdx) +
      wrappedContent +
      claudeMdContent.slice(endIdx)
    );
  }

  // Append to end with a newline separator
  const separator = claudeMdContent.endsWith("\n") ? "\n" : "\n\n";
  return claudeMdContent + separator + wrappedContent + "\n";
}
