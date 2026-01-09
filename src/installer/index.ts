import { existsSync, mkdirSync, writeFileSync, lstatSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { generateSkillWithClone } from "../generator/index.js";
import type { SkillMeta } from "../version/meta.js";
import {
  sortAgentsByDir,
  createSymlinkToAgent,
  getAgentSkillPath,
  type SymlinkResult,
} from "./symlink.js";
import type { AgentId } from "../agents/types.js";

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
  const docsDir = join(primaryPath, "docs");

  try {
    // Ensure primary skill directory exists
    if (!existsSync(primaryPath)) {
      mkdirSync(primaryPath, { recursive: true });
    } else {
      // Remove if it's a symlink (switching from secondary to primary)
      const stat = lstatSync(primaryPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(primaryPath);
        mkdirSync(primaryPath, { recursive: true });
      }
    }

    // Generate skill by cloning docs (this populates docs/)
    const { content, libVersion, skillVersion } = await generateSkillWithClone(
      nextjsVersion,
      docsDir
    );

    // Write SKILL.md
    writeFileSync(join(primaryPath, "SKILL.md"), content, "utf-8");

    // Write metadata
    const meta: SkillMeta = {
      skillVersion,
      libVersion,
      installedAt: new Date().toISOString(),
      agents: sortedAgents,
    };
    writeFileSync(
      join(primaryPath, ".next-skills-meta.json"),
      JSON.stringify(meta, null, 2),
      "utf-8"
    );

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

export * from "./detect.js";
export * from "./sync.js";
export * from "./symlink.js";
