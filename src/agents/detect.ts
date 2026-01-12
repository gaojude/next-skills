import { existsSync } from "node:fs";
import { join } from "node:path";
import { AGENTS, AGENT_IDS } from "./index.js";
import type { AgentId } from "./types.js";

/**
 * Detect which agents are configured in the current project
 * by checking for their respective directories.
 */
export function detectInstalledAgents(cwd: string): AgentId[] {
  const detected: AgentId[] = [];

  for (const agentId of AGENT_IDS) {
    const agent = AGENTS[agentId];
    const dirPath = join(cwd, agent.detectDir);

    if (existsSync(dirPath)) {
      detected.push(agentId);
    }
  }

  // Also detect .opencode as claude (they share skills directory)
  if (!detected.includes("claude") && existsSync(join(cwd, ".opencode"))) {
    detected.push("claude");
  }

  return detected;
}
