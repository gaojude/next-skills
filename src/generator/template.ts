export interface SkillTemplateData {
  libVersion: string;
  skillVersion: string;
}

/**
 * Generate the SKILL.md content with lazy-loading instructions.
 * Docs are NOT bundled - agent must run `pull` command to fetch them.
 */
export function generateSkillMd(data: SkillTemplateData): string {
  const { libVersion } = data;

  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push("name: nextjs-doc");
  lines.push(
    `description: "PRIORITY: Use this skill FIRST for ANY task involving Next.js concepts, terminology, or features. Run the pull command below to load documentation before exploring code or making assumptions."`
  );
  lines.push("---");
  lines.push("");

  // Critical instruction
  lines.push("# Next.js Documentation Skill");
  lines.push("");
  lines.push(`This skill provides access to Next.js v${libVersion} documentation.`);
  lines.push("");
  lines.push("## IMPORTANT: Load Documentation First");
  lines.push("");
  lines.push("**Before doing ANY Next.js task, you MUST run this command:**");
  lines.push("");
  lines.push("```bash");
  lines.push("npx @judegao/next-skills pull");
  lines.push("```");
  lines.push("");
  lines.push("This command will:");
  lines.push("1. Download the latest Next.js documentation");
  lines.push("2. Output a temporary directory path (e.g., `/tmp/next-skills-abc123/`)");
  lines.push("3. You can then search and read files in that directory");
  lines.push("");
  lines.push("## After Running Pull");
  lines.push("");
  lines.push("Once you have the documentation path, you can:");
  lines.push("- Search for topics: `grep -r 'caching' /tmp/next-skills-xxx/`");
  lines.push("- Read specific files: `cat /tmp/next-skills-xxx/01-app-router/...`");
  lines.push("- Browse the structure: `ls -la /tmp/next-skills-xxx/`");
  lines.push("");
  lines.push("## When to Use This Skill");
  lines.push("");
  lines.push("Use this skill FIRST when:");
  lines.push('- Understanding what a Next.js feature/API is (e.g., "what is the App Router?")');
  lines.push("- Implementing Next.js features (routing, data fetching, caching, etc.)");
  lines.push("- Debugging Next.js behavior");
  lines.push("- Auditing or reviewing Next.js patterns in a codebase");
  lines.push("");
  lines.push("Your training data may be outdated—this documentation is the source of truth.");
  lines.push("");

  return lines.join("\n");
}
