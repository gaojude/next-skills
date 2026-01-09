import type { Agent, AgentId } from "./types.js";

export const AGENTS: Record<AgentId, Agent> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    detectDir: ".claude",
    skillsDir: ".claude/skills",
  },
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    detectDir: ".gemini",
    skillsDir: ".gemini/skills",
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    detectDir: ".github",
    skillsDir: ".github/skills",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    detectDir: ".cursor",
    skillsDir: ".cursor/skills",
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    detectDir: ".opencode",
    skillsDir: ".opencode/skills",
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];

export function getAgent(id: AgentId): Agent {
  return AGENTS[id];
}

export function getSkillPath(agentId: AgentId, skillName: string): string {
  const agent = AGENTS[agentId];
  return `${agent.skillsDir}/${skillName}`;
}

export * from "./types.js";
