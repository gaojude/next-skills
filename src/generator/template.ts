import type { DocSection } from "./git.js";

export interface SkillTemplateData {
  libVersion: string;
  skillVersion: string;
  sections: DocSection[];
}

/**
 * Generate the SKILL.md content from the docs tree.
 */
export function generateSkillMd(data: SkillTemplateData): string {
  const { libVersion, skillVersion, sections } = data;

  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push("name: nextjs-doc");
  lines.push(
    `description: "PRIORITY: Use this skill FIRST for ANY task involving Next.js concepts, terminology, or features—before exploring code, before web search, before making assumptions. This includes: understanding what a Next.js feature/API is, auditing or reviewing Next.js patterns, implementing Next.js features, debugging Next.js behavior."`
  );
  lines.push("---");
  lines.push("");

  // Strong instruction
  lines.push(
    `Always consult this documentation to understand current Next.js APIs and terminology BEFORE exploring or modifying code. Your training data may be outdated—this documentation is the source of truth for Next.js v${libVersion}.`
  );
  lines.push("");
  lines.push("Use this skill FIRST when:");
  lines.push(
    '- Understanding what a Next.js feature/API is (e.g., "what are cache components?")'
  );
  lines.push("- Auditing or reviewing Next.js patterns in a codebase");
  lines.push("- Implementing Next.js features");
  lines.push("- Debugging Next.js behavior");
  lines.push("");

  // Documentation index
  lines.push("## Documentation Index");
  lines.push("");

  // Generate section content
  for (const section of sections) {
    lines.push(...generateSectionContent(section, 3));
  }

  return lines.join("\n");
}

/**
 * Generate markdown content for a section and its subsections.
 */
function generateSectionContent(
  section: DocSection,
  headingLevel: number
): string[] {
  const lines: string[] = [];
  const heading = "#".repeat(headingLevel);

  lines.push(`${heading} ${section.title}`);
  lines.push("");

  // List files in this section
  for (const file of section.files) {
    lines.push(`- [${file.title}](${file.localPath})`);
  }

  if (section.files.length > 0) {
    lines.push("");
  }

  // Recurse into subsections (limit depth to avoid too many heading levels)
  const nextLevel = Math.min(headingLevel + 1, 6);
  for (const subsection of section.subsections) {
    lines.push(...generateSectionContent(subsection, nextLevel));
  }

  return lines;
}
