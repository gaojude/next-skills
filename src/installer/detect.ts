import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta, type SkillMeta } from "../version/meta.js";
import { AGENTS, AGENT_IDS } from "../agents/index.js";
import { sortAgentsByDir } from "./symlink.js";

const SKILL_NAME = "nextjs-doc";

export interface InstallationStatus {
  installed: boolean;
  meta: SkillMeta | null;
  primaryPath: string | null;
}

/**
 * Check if the skill is already installed by scanning all agent directories.
 * Looks in alphabetically-first agent directory (primary location convention).
 */
export function detectExistingInstallation(cwd: string): InstallationStatus {
  // Check in alphabetical order - the first one found with real files is primary
  const sortedAgents = sortAgentsByDir(AGENT_IDS);

  for (const agentId of sortedAgents) {
    const agent = AGENTS[agentId];
    const skillPath = join(cwd, agent.skillsDir, SKILL_NAME);
    const skillMdPath = join(skillPath, "SKILL.md");

    if (existsSync(skillMdPath)) {
      const meta = readSkillMeta(skillPath);
      return {
        installed: true,
        meta,
        primaryPath: skillPath,
      };
    }
  }

  return {
    installed: false,
    meta: null,
    primaryPath: null,
  };
}

/**
 * Check if the installed skill needs updating.
 */
export function needsUpdate(
  currentMeta: SkillMeta | null,
  newLibVersion: string,
  newSkillVersion: string
): { needsUpdate: boolean; reason?: string } {
  if (!currentMeta) {
    return { needsUpdate: true, reason: "Not installed" };
  }

  if (currentMeta.libVersion !== newLibVersion) {
    return {
      needsUpdate: true,
      reason: `Next.js version changed: ${currentMeta.libVersion} → ${newLibVersion}`,
    };
  }

  if (currentMeta.skillVersion !== newSkillVersion) {
    return {
      needsUpdate: true,
      reason: `Skill generator updated: ${currentMeta.skillVersion} → ${newSkillVersion}`,
    };
  }

  return { needsUpdate: false };
}
