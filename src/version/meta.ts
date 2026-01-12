import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SkillEntry {
  /** Version of the next-skills package that generated this skill */
  skillVersion: string;
  /** Version of Next.js the docs are generated for */
  libVersion: string;
  /** ISO timestamp of when the skill was installed */
  installedAt: string;
}

export interface SkillsMetadata {
  skills: Record<string, SkillEntry>;
}

const META_FILENAME = ".next-skills.json";

/**
 * Get the path to the metadata file for a skills directory.
 */
export function getMetaPath(skillsDir: string): string {
  return join(skillsDir, META_FILENAME);
}

/**
 * Read the skills metadata from the skills directory.
 */
export function readSkillsMetadata(skillsDir: string): SkillsMetadata | null {
  const metaPath = getMetaPath(skillsDir);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content) as SkillsMetadata;
  } catch {
    return null;
  }
}

/**
 * Write the skills metadata to the skills directory.
 */
export function writeSkillsMetadata(skillsDir: string, meta: SkillsMetadata): void {
  const metaPath = getMetaPath(skillsDir);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
}

/**
 * Read a specific skill's metadata.
 */
export function readSkillMeta(skillsDir: string, skillName: string): SkillEntry | null {
  const metadata = readSkillsMetadata(skillsDir);
  if (!metadata) {
    return null;
  }
  return metadata.skills[skillName] || null;
}

/**
 * Write a specific skill's metadata.
 */
export function writeSkillMeta(
  skillsDir: string,
  skillName: string,
  entry: SkillEntry
): void {
  const metadata = readSkillsMetadata(skillsDir) || { skills: {} };
  metadata.skills[skillName] = entry;
  writeSkillsMetadata(skillsDir, metadata);
}

/**
 * Remove a skill from metadata.
 */
export function removeSkillMeta(skillsDir: string, skillName: string): void {
  const metadata = readSkillsMetadata(skillsDir);
  if (metadata && metadata.skills[skillName]) {
    delete metadata.skills[skillName];
    writeSkillsMetadata(skillsDir, metadata);
  }
}

/**
 * Get all installed skill names from metadata.
 */
export function getInstalledSkillNames(skillsDir: string): string[] {
  const metadata = readSkillsMetadata(skillsDir);
  if (!metadata) {
    return [];
  }
  return Object.keys(metadata.skills);
}

/**
 * Get the current package version from our own package.json.
 */
export function getOwnPackageVersion(): string {
  // When running from dist/, package.json is two levels up
  try {
    // Try the installed location first (node_modules/next-skills/package.json)
    const possiblePaths = [
      join(import.meta.dirname, "..", "..", "package.json"),
      join(import.meta.dirname, "..", "package.json"),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        const pkg = JSON.parse(readFileSync(path, "utf-8"));
        return pkg.version || "0.0.0";
      }
    }
  } catch {
    // Fallback
  }

  return "0.0.0";
}
