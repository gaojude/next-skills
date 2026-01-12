import type { Agent, AgentId } from "./types.js";

export const AGENTS: Record<AgentId, Agent> = {
  claude: {
    id: "claude",
    name: "Claude Code / OpenCode",
    detectDir: ".claude",
    skillsDir: ".claude/skills",
  },
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    detectDir: ".gemini",
    skillsDir: ".gemini/skills",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    detectDir: ".cursor",
    skillsDir: ".cursor/skills",
  },
  codex: {
    id: "codex",
    name: "Codex",
    detectDir: ".codex",
    skillsDir: ".codex/skills",
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];

export * from "./types.js";
