---
name: agentos-sync
description: Sync execution logs and output to AgentOS. Use when the user wants to stream their Codex/Cursor/OpenClaw session to AgentOS for realtime visibility. Creates a task automatically, sets AI Working status, and streams all output to the execution console.
---

# AgentOS Sync

Stream execution logs and output from this session to AgentOS. A task is created automatically with "AI Working" status; all output appears in the AgentOS execution console in realtime.

## When to Use

- User asks to sync with AgentOS, stream to AgentOS, or show execution in AgentOS
- User wants their work visible in the AgentOS execution console
- The **first user prompt** includes `#agentos` (auto-enable sync for that session)

## Priority Rule

If `#agentos` is attached in the prompt, **initialize AgentOS sync first**, then proceed with the actual task.

## Setup (one-time)

Read from environment variables. Do not ask the user for task ID, project ID, or token in chat—use env vars.

1. **AGENTOS_ACCESS_TOKEN** (required): AgentOS JWT. User gets it from AgentOS → Settings → API Keys → Copy access token.
2. **AGENTOS_PROJECT_ID** (required): Project UUID where tasks are created. User gets it from AgentOS (Settings → External Sync → Copy project ID, or from the app URL when viewing a project).
3. **AGENTOS_API_URL** (optional): Default `http://localhost:4000`.

If env vars are not set, tell the user once: "To sync with AgentOS, set AGENTOS_ACCESS_TOKEN and AGENTOS_PROJECT_ID in your environment. See the agentos-sync README for setup."

## Workflow

1. **Create task and register session**: Call `POST /runs/external` with `{ projectId: "<AGENTOS_PROJECT_ID>", source: "codex" }` (or "claude"/"openclaw"). Optionally include `title` for the task (default: "External sync from {source}"). Use `Authorization: Bearer <AGENTOS_ACCESS_TOKEN>`.
2. **Store runId and taskId**: Save the returned `runId`; use it for all subsequent calls. The task is created with "AI Working" status.
3. **Emit chunks**: As you execute (run commands, read files, log progress), call `POST /runs/:runId/chunks` with a `StreamChunk` in the body. See [references/api.md](references/api.md) for chunk types.
4. **Signal done**: When execution completes, call `POST /runs/:runId/done` with optional `{ result, output, chunks }`. This moves the task to **Review** status.

## Status Rules

- While the agent is still working, the task must remain **AI Working**.
- When the chat finishes, call `/runs/:runId/done` to move the task to **Review**.

Do not ask the user for task ID or project ID. Create the task automatically via the API.

## Chunk Types

Map your actions to these types:

- `agent_log` – General log line: `{ type: "agent_log", level: "info"|"warn"|"error", message, payload? }`
- `section` – Grouped output: `{ type: "section", title, content? }`
- `command` – Terminal command + output: `{ type: "command", command, output?, status?: "running"|"done"|"error" }`
- `read_file` – File read: `{ type: "read_file", path, summary?, tokens? }`
- `text` – Plain text: `{ type: "text", content }`
- `user_prompt` – When you need user input: `{ type: "user_prompt", message }`

## API Base URL

Default: `http://localhost:4000`. Override with `AGENTOS_API_URL` if the user's AgentOS instance is elsewhere.

For full API details, see [references/api.md](references/api.md).
