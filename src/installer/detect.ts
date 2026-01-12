import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta, type SkillEntry } from "../version/meta.js";
import { AGENTS, AGENT_IDS, type AgentId } from "../agents/index.js";
import { sortAgentsByDir } from "./symlink.js";

const SKILL_NAME = "nextjs-doc";

export interface InstallationStatus {
  installed: boolean;
  meta: SkillEntry | null;
  primaryPath: string | null;
  skillsDir: string | null;
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
    const skillsDir = join(cwd, agent.skillsDir);
    const skillPath = join(skillsDir, SKILL_NAME);
    const skillMdPath = join(skillPath, "SKILL.md");

    if (existsSync(skillMdPath)) {
      // Read from skills directory level (one level up from skill folder)
      const meta = readSkillMeta(skillsDir, SKILL_NAME);
      return {
        installed: true,
        meta,
        primaryPath: skillPath,
        skillsDir,
      };
    }
  }

  return {
    installed: false,
    meta: null,
    primaryPath: null,
    skillsDir: null,
  };
}

/**
 * Check if the installed skill needs updating.
 */
export function needsUpdate(
  currentMeta: SkillEntry | null,
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

/**
 * Get list of agents that have the skill installed (either primary files or symlinks).
 */
export function getInstalledAgents(cwd: string): AgentId[] {
  const installed: AgentId[] = [];

  for (const agentId of AGENT_IDS) {
    const agent = AGENTS[agentId];
    const skillPath = join(cwd, agent.skillsDir, SKILL_NAME);
    const skillMdPath = join(skillPath, "SKILL.md");

    if (existsSync(skillMdPath)) {
      installed.push(agentId);
    }
  }

  return installed;
}
