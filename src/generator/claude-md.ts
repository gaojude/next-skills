import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DocSection } from "./git.js";

export interface ClaudeMdIndexData {
  libVersion: string;
  docsPath: string;
  sections: DocSection[];
  githubDocsUrl?: string;
  outputFile?: string;
}

/**
 * Generate the documentation index content for CLAUDE.md injection.
 * Single-line compact format with pipe separators.
 */
export function generateClaudeMdIndex(data: ClaudeMdIndexData): string {
  const { docsPath, sections, githubDocsUrl, outputFile } = data;

  const parts: string[] = [];

  // Preamble with essential instructions
  parts.push("[Next.js Docs Index]");
  parts.push(`root: ${docsPath}`);
  parts.push("IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any Next.js tasks.");
  const targetFile = outputFile || "CLAUDE.md";
  parts.push(`If docs missing run: npx @judegao/next-agents-md --md ${targetFile}`);

  // Collect all files with their full paths, then group by directory
  const allFiles = collectAllFiles(sections, "");
  const grouped = groupByDirectory(allFiles);

  // Format: dir/:{file1,file2,file3}
  for (const [dir, files] of grouped) {
    parts.push(`${dir}:{${files.join(",")}}`);
  }

  return parts.join("|");
}

/**
 * Recursively collect all files from sections with their relative paths.
 */
function collectAllFiles(
  sections: DocSection[],
  parentPath: string
): string[] {
  const files: string[] = [];

  for (const section of sections) {
    for (const file of section.files) {
      files.push(file.relativePath);
    }
    files.push(...collectAllFiles(section.subsections, parentPath));
  }

  return files;
}

/**
 * Group files by their parent directory.
 */
function groupByDirectory(files: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const filePath of files) {
    const lastSlash = filePath.lastIndexOf("/");
    const dir = lastSlash === -1 ? "." : filePath.slice(0, lastSlash);
    const fileName = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);

    const existing = grouped.get(dir);
    if (existing) {
      existing.push(fileName);
    } else {
      grouped.set(dir, [fileName]);
    }
  }

  return grouped;
}

/**
 * Wrap the index content with markers for easy identification and replacement.
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

// Nudge markers and content
const NUDGE_START_MARKER = "<!-- NEXT-AGENTS-MD-NUDGE-START -->";
const NUDGE_END_MARKER = "<!-- NEXT-AGENTS-MD-NUDGE-END -->";

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
