import type { DocSection } from "./git.js";

export interface ClaudeMdIndexData {
  libVersion: string;
  docsPath: string;
  sections: DocSection[];
  githubDocsUrl?: string;
}

/**
 * Generate the documentation index content for CLAUDE.md injection.
 * This creates a hierarchical index with references to the pulled docs.
 */
export function generateClaudeMdIndex(data: ClaudeMdIndexData): string {
  const { libVersion, docsPath, sections, githubDocsUrl } = data;

  const lines: string[] = [];

  // Header
  lines.push("## Next.js Documentation Index");
  lines.push("");
  lines.push(`> This is the official Next.js v${libVersion} documentation. Use this as your source of truth for ANY Next.js-related work.`);
  lines.push("");
  lines.push(`> Documentation location: \`${docsPath}\``);
  if (githubDocsUrl) {
    lines.push(`> GitHub source (versioned link): ${githubDocsUrl}`);
  }
  lines.push(">");
  lines.push("> **If the documentation files are missing**, run: `npx @judegao/next-skills --experimental-claude-md`");
  lines.push("");

  // Generate section content
  for (const section of sections) {
    lines.push(...generateSectionContent(section, docsPath, 3));
  }

  return lines.join("\n");
}

/**
 * Generate markdown content for a section and its subsections.
 */
function generateSectionContent(
  section: DocSection,
  docsPath: string,
  headingLevel: number
): string[] {
  const lines: string[] = [];
  const heading = "#".repeat(headingLevel);

  lines.push(`${heading} ${section.title}`);
  lines.push("");

  // List files in this section
  for (const file of section.files) {
    const fullPath = `${docsPath}/${file.relativePath}`;
    lines.push(`- [${file.title}](${fullPath})`);
  }

  if (section.files.length > 0) {
    lines.push("");
  }

  // Recurse into subsections (limit depth to avoid too many heading levels)
  const nextLevel = Math.min(headingLevel + 1, 6);
  for (const subsection of section.subsections) {
    lines.push(...generateSectionContent(subsection, docsPath, nextLevel));
  }

  return lines;
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
