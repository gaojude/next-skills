import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

  // Preamble to encourage Claude to actually read the docs
  lines.push("# Next.js Documentation");
  lines.push("");
  lines.push("Your training data may be outdated. These docs are version-matched to this project.");
  lines.push("");
  lines.push("**BEFORE writing any Next.js code:** Search the docs index below for relevant topics, then READ those .mdx files. APIs and configuration have changed.");
  lines.push("");

  // Header
  lines.push("## Documentation Index");
  lines.push("");
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

// Nudge markers and content
const NUDGE_START_MARKER = "<!-- NEXT-SKILLS-NUDGE-START -->";
const NUDGE_END_MARKER = "<!-- NEXT-SKILLS-NUDGE-END -->";

const NUDGE_CONTENT = `# Next.js Project

Before writing code, first explore the project structure, then invoke the \`nextjs-doc\` skill for documentation.`;

export interface NudgeResult {
  path: string;
  created: boolean;
  updated: boolean;
}

/**
 * Check if CLAUDE.md already has the nudge content.
 */
export function hasExistingNudge(claudeMdContent: string): boolean {
  return claudeMdContent.includes(NUDGE_START_MARKER);
}

/**
 * Wrap nudge content with markers.
 */
function wrapNudgeWithMarkers(content: string): string {
  return `${NUDGE_START_MARKER}\n${content}\n${NUDGE_END_MARKER}`;
}

/**
 * Inject nudge content into CLAUDE.md (at the beginning).
 */
function injectNudge(claudeMdContent: string, nudgeContent: string): string {
  const wrappedContent = wrapNudgeWithMarkers(nudgeContent);

  if (hasExistingNudge(claudeMdContent)) {
    // Replace existing nudge content between markers
    const startIdx = claudeMdContent.indexOf(NUDGE_START_MARKER);
    const endIdx = claudeMdContent.indexOf(NUDGE_END_MARKER) + NUDGE_END_MARKER.length;

    return (
      claudeMdContent.slice(0, startIdx) +
      wrappedContent +
      claudeMdContent.slice(endIdx)
    );
  }

  // Prepend to beginning with a newline separator
  const separator = claudeMdContent.length > 0 ? "\n\n" : "";
  return wrappedContent + separator + claudeMdContent;
}

/**
 * Write CLAUDE.md with exploration-first nudge guidance.
 * Creates the file if it doesn't exist, or updates it if it does.
 */
export function writeClaudeMdNudge(cwd: string): NudgeResult {
  const claudeMdPath = join(cwd, "CLAUDE.md");

  let existingContent = "";
  let isNewFile = true;

  if (existsSync(claudeMdPath)) {
    existingContent = readFileSync(claudeMdPath, "utf-8");
    isNewFile = false;
  }

  // Check if already has the exact nudge content
  const alreadyHasNudge = hasExistingNudge(existingContent);

  const newContent = injectNudge(existingContent, NUDGE_CONTENT);
  writeFileSync(claudeMdPath, newContent, "utf-8");

  return {
    path: claudeMdPath,
    created: isNewFile,
    updated: !isNewFile && !alreadyHasNudge,
  };
}
