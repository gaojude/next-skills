export interface ClaudeMdIndexData {
  docsPath: string;
  files: { relativePath: string }[];
  githubDocsUrl?: string;
}

/**
 * Generate the documentation index content for CLAUDE.md injection.
 * This creates a compact, directory-grouped index for the pulled docs.
 */
export function generateClaudeMdIndex(data: ClaudeMdIndexData): string {
  const { docsPath, files, githubDocsUrl } = data;

  const lines: string[] = [];

  // Preamble to encourage Claude to actually read the docs
  lines.push("# Next.js Documentation");
  lines.push("");
  lines.push("Your training data may be outdated. These docs are version-matched to this project.");
  lines.push("");
  lines.push("**BEFORE writing any Next.js code:** Search the docs index below for relevant topics, then READ those .mdx files. APIs and configuration have changed.");
  lines.push("");

  // Header
  lines.push("## Documentation Index (compact)");
  lines.push("");
  lines.push(`Docs root: ${docsPath}`);
  if (githubDocsUrl) {
    lines.push(`GitHub docs: ${githubDocsUrl}`);
  }
  lines.push("Format: <dir/> followed by filenames (paths relative to docs root).");
  lines.push("Tip: strip numeric prefixes and hyphens to read titles.");
  lines.push("> **If the documentation files are missing**, run: `npx @judegao/next-skills`");
  lines.push("");

  const groupedFiles = groupFilesByDirectory(files);
  for (const group of groupedFiles) {
    const dirLabel = group.dir === "." ? "(root)" : group.dir;
    lines.push(`${dirLabel}/`);
    for (const file of group.files) {
      lines.push(`  ${file}`);
    }
  }

  return lines.join("\n");
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
 */
export function wrapWithMarkers(content: string): string {
  const START_MARKER = "<!-- NEXT-SKILLS-START -->";
  const END_MARKER = "<!-- NEXT-SKILLS-END -->";

  return `${START_MARKER}\n${content}\n${END_MARKER}`;
}

/**
 * Check if CLAUDE.md already has our markers.
 */
export function hasExistingIndex(claudeMdContent: string): boolean {
  return claudeMdContent.includes("<!-- NEXT-SKILLS-START -->");
}

/**
 * Replace existing index or append new one.
 */
export function injectIntoClaudeMd(
  claudeMdContent: string,
  indexContent: string
): string {
  const START_MARKER = "<!-- NEXT-SKILLS-START -->";
  const END_MARKER = "<!-- NEXT-SKILLS-END -->";
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
