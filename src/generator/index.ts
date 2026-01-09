import { cloneDocsFolder, collectDocFiles, buildDocTree } from "./git.js";
import { generateSkillMd } from "./template.js";
import { versionToGitHubTag } from "../version/release.js";
import { getOwnPackageVersion } from "../version/meta.js";

export interface GenerateResult {
  content: string;
  libVersion: string;
  skillVersion: string;
}

/**
 * Generate the skill by cloning docs from GitHub.
 * Uses git sparse-checkout to avoid API rate limits.
 */
export async function generateSkillWithClone(
  nextjsVersion: string,
  referencesDir: string
): Promise<GenerateResult> {
  const tag = versionToGitHubTag(nextjsVersion);
  const skillVersion = getOwnPackageVersion();

  // Clone only the docs folder to the references directory
  await cloneDocsFolder(tag, referencesDir);

  // Collect all doc files
  const files = collectDocFiles(referencesDir);

  // Build the doc tree structure
  const sections = buildDocTree(files);

  // Generate the SKILL.md content
  const content = generateSkillMd({
    libVersion: nextjsVersion,
    skillVersion,
    sections,
  });

  return {
    content,
    libVersion: nextjsVersion,
    skillVersion,
  };
}

export * from "./git.js";
export * from "./template.js";
