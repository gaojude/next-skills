import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentId } from "../agents/types.js";

export interface SkillMeta {
  /** Version of the next-skills package that generated this skill */
  skillVersion: string;
  /** Version of Next.js the docs are generated for */
  libVersion: string;
  /** ISO timestamp of when the skill was installed */
  installedAt: string;
  /** Which agents this skill is installed for */
  agents: AgentId[];
}

const META_FILENAME = ".next-skills-meta.json";

/**
 * Read the skill metadata from the canonical location.
 */
export function readSkillMeta(skillDir: string): SkillMeta | null {
  const metaPath = join(skillDir, META_FILENAME);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content) as SkillMeta;
  } catch {
    return null;
  }
}

/**
 * Write the skill metadata to the canonical location.
 */
export function writeSkillMeta(skillDir: string, meta: SkillMeta): void {
  const metaPath = join(skillDir, META_FILENAME);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
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
