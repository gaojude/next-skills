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
    `description: "Look up Next.js documentation for the project's version."`
  );
  lines.push("---");
  lines.push("");

  lines.push(
    `This skill provides Next.js documentation matching the project's Next.js version.`
  );
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
