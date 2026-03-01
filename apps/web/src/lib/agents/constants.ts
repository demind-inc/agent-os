import type { AgentBackend } from "@/types/domain";

export const AGENT_BACKENDS: { value: AgentBackend; label: string }[] = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" }
];

export const AGENT_MODELS: Record<AgentBackend, { value: string; label: string }[]> = {
  claude: [
    { value: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet" },
    { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-opus", label: "Claude 3 Opus" }
  ],
  codex: [
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-codex", label: "GPT-5 Codex" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" }
  ]
};

export const AVAILABLE_SKILLS = [
  "web-search",
  "synthesis",
  "docs",
  "breakdown",
  "timeline",
  "api",
  "copy",
  "readme",
  "github",
  "ui",
  "todoist"
] as const;
