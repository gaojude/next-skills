export interface Agent {
  id: string;
  name: string;
  /** The directory to check for detection (e.g., ".claude") */
  detectDir: string;
  /** The full path to the skills directory (e.g., ".claude/skills") */
  skillsDir: string;
}

export type AgentId = "claude" | "gemini" | "copilot" | "cursor" | "opencode";
