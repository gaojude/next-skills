import { generateSkillMd } from "./template.js";
import { getOwnPackageVersion } from "../version/meta.js";

export interface GenerateResult {
  content: string;
  libVersion: string;
  skillVersion: string;
}

/**
 * Generate the SKILL.md content (without cloning docs).
 * Docs are lazy-loaded via the `pull` command.
 */
export function generateSkill(nextjsVersion: string): GenerateResult {
  const skillVersion = getOwnPackageVersion();

  // Generate the SKILL.md content (no docs bundled - they're lazy-loaded)
  const content = generateSkillMd({
    libVersion: nextjsVersion,
    skillVersion,
  });

  return {
    content,
    libVersion: nextjsVersion,
    skillVersion,
  };
}

export * from "./git.js";
export * from "./template.js";
