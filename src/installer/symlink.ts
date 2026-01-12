import {
  existsSync,
  mkdirSync,
  symlinkSync,
  lstatSync,
  unlinkSync,
  cpSync,
  rmSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { AGENTS } from "../agents/index.js";
import type { AgentId } from "../agents/types.js";

const SKILL_NAME = "nextjs-doc";

export interface SymlinkResult {
  agentId: AgentId;
  success: boolean;
  path: string;
  isPrimary?: boolean;
  error?: string;
  usedCopy?: boolean;
}

/**
 * Get the skill path for an agent.
 */
export function getAgentSkillPath(cwd: string, agentId: AgentId): string {
  const agent = AGENTS[agentId];
  return join(cwd, agent.skillsDir, SKILL_NAME);
}

/**
 * Sort agents alphabetically by their directory name.
 * The first one will hold the real files.
 */
export function sortAgentsByDir(agentIds: AgentId[]): AgentId[] {
  return [...agentIds].sort((a, b) => {
    const dirA = AGENTS[a].skillsDir;
    const dirB = AGENTS[b].skillsDir;
    return dirA.localeCompare(dirB);
  });
}

/**
 * Create a symlink from a secondary agent to the primary.
 */
export function createSymlinkToAgent(
  cwd: string,
  agentId: AgentId,
  primaryPath: string
): SymlinkResult {
  const skillPath = getAgentSkillPath(cwd, agentId);

  try {
    // Ensure the agent's skills directory exists
    const skillsDir = dirname(skillPath);
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    // Remove existing symlink or directory
    if (existsSync(skillPath)) {
      const stat = lstatSync(skillPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(skillPath);
      } else if (stat.isDirectory()) {
        rmSync(skillPath, { recursive: true });
      }
    }

    // Calculate relative path for symlink
    const relativePath = relative(skillsDir, primaryPath);

    try {
      // Try to create symlink
      symlinkSync(relativePath, skillPath, "junction");
      return {
        agentId,
        success: true,
        path: skillPath,
      };
    } catch {
      // Symlink failed (likely Windows without admin/dev mode)
      // Fall back to copying
      cpSync(primaryPath, skillPath, { recursive: true });
      return {
        agentId,
        success: true,
        path: skillPath,
        usedCopy: true,
      };
    }
  } catch (error) {
    return {
      agentId,
      success: false,
      path: skillPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove the skill from an agent.
 */
export function removeSkillFromAgent(cwd: string, agentId: AgentId): boolean {
  const skillPath = getAgentSkillPath(cwd, agentId);

  try {
    if (existsSync(skillPath)) {
      const stat = lstatSync(skillPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(skillPath);
      } else if (stat.isDirectory()) {
        rmSync(skillPath, { recursive: true });
      }
      return true;
    }
    return true; // Already doesn't exist
  } catch {
    return false;
  }
}
