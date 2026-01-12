import { existsSync, mkdirSync, writeFileSync, lstatSync, unlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { generateSkillWithClone } from "../generator/index.js";
import { writeSkillMeta, removeSkillMeta, getInstalledSkillNames, type SkillEntry } from "../version/meta.js";
import {
  sortAgentsByDir,
  createSymlinkToAgent,
  getAgentSkillPath,
  removeSkillFromAgent,
  type SymlinkResult,
} from "./symlink.js";
import type { AgentId } from "../agents/types.js";

const SKILL_NAME = "nextjs-doc";

export interface InstallOptions {
  cwd: string;
  nextjsVersion: string;
  agents: AgentId[];
}

export interface InstallResult {
  success: boolean;
  primaryPath: string;
  libVersion: string;
  skillVersion: string;
  agentResults: SymlinkResult[];
  error?: string;
}

/**
 * Install the Next.js documentation skill.
 *
 * Files are stored in the alphabetically-first agent's directory.
 * Other agents get symlinks to that location.
 */
export async function installSkill(
  options: InstallOptions
): Promise<InstallResult> {
  const { cwd, nextjsVersion, agents } = options;

  // Sort agents alphabetically - first one gets the real files
  const sortedAgents = sortAgentsByDir(agents);
  const primaryAgent = sortedAgents[0];
  const secondaryAgents = sortedAgents.slice(1);
  const primaryPath = getAgentSkillPath(cwd, primaryAgent);
  const skillsDir = dirname(primaryPath);
  const docsDir = join(primaryPath, "docs");

  try {
    // Clean up existing skill folders from primary location
    // Secondary agents just have symlinks that will be recreated
    const installedSkills = getInstalledSkillNames(skillsDir);
    for (const skillName of installedSkills) {
      const skillPath = join(skillsDir, skillName);
      if (existsSync(skillPath)) {
        rmSync(skillPath, { recursive: true });
      }
    }

    // Remove symlinks from secondary agents
    for (const agentId of secondaryAgents) {
      const symlinkPath = getAgentSkillPath(cwd, agentId);
      if (existsSync(symlinkPath)) {
        const stat = lstatSync(symlinkPath);
        if (stat.isSymbolicLink()) {
          unlinkSync(symlinkPath);
        }
      }
    }

    // Create primary skill directory
    mkdirSync(primaryPath, { recursive: true });

    // Generate skill by cloning docs (this populates docs/)
    const { content, libVersion, skillVersion } = await generateSkillWithClone(
      nextjsVersion,
      docsDir
    );

    // Write SKILL.md
    writeFileSync(join(primaryPath, "SKILL.md"), content, "utf-8");

    // Write metadata to skills directory level
    const meta: SkillEntry = {
      skillVersion,
      libVersion,
      installedAt: new Date().toISOString(),
    };
    writeSkillMeta(skillsDir, SKILL_NAME, meta);

    const agentResults: SymlinkResult[] = [
      {
        agentId: primaryAgent,
        success: true,
        path: primaryPath,
        isPrimary: true,
      },
    ];

    // Create symlinks for secondary agents
    for (const agentId of secondaryAgents) {
      const result = createSymlinkToAgent(cwd, agentId, primaryPath);
      agentResults.push(result);
    }

    const allSuccess = agentResults.every((r) => r.success);

    return {
      success: allSuccess,
      primaryPath,
      libVersion,
      skillVersion,
      agentResults,
    };
  } catch (error) {
    return {
      success: false,
      primaryPath,
      libVersion: nextjsVersion,
      skillVersion: "unknown",
      agentResults: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Uninstall the skill from all specified agents.
 */
export function uninstallSkill(cwd: string, agents: AgentId[]): void {
  if (agents.length === 0) return;

  const sortedAgents = sortAgentsByDir(agents);
  const primaryAgent = sortedAgents[0];
  const primaryPath = getAgentSkillPath(cwd, primaryAgent);
  const skillsDir = dirname(primaryPath);

  // Remove from all agents
  for (const agentId of agents) {
    removeSkillFromAgent(cwd, agentId);
  }

  // Remove metadata
  removeSkillMeta(skillsDir, SKILL_NAME);
}

export * from "./detect.js";
export * from "./symlink.js";
