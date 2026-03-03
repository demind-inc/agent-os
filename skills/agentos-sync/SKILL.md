---
name: agentos-sync
description: Sync execution logs and output to AgentOS. Use when the user wants to stream their Codex/Cursor/OpenClaw session to AgentOS for realtime visibility. Register a session with taskId, emit StreamChunks (text, section, command, agent_log, etc.) as you work, and call done when finished.
---

# AgentOS Sync

Stream execution logs and output from this session to AgentOS so the user can view realtime progress in the app.

## When to Use

- User asks to sync with AgentOS, stream to AgentOS, or show execution in AgentOS
- User provides an AgentOS task ID and wants this session linked to it
- User wants their work visible in the AgentOS execution console

## Setup

**When the user invokes this skill, always ask them to paste the AgentOS access token in chat.** Do not assume env vars are set.

1. **Access token:** Ask the user: "Please paste your AgentOS access token. You can get it from AgentOS → Settings → API Keys → Copy access token." Use the token they paste in chat. Do not use a token from env vars if the user provides one in chat—prefer the chat value. If the token fails (401), ask them to get a fresh token (Settings → Copy access token refreshes the session).
2. **API URL:** Default `http://localhost:4000`. Override with `AGENTOS_API_URL` if the user says their instance is elsewhere.
3. **Task ID:** Ask the user for the `taskId` (UUID of the task in AgentOS to link this run to).

## Workflow

1. **Register session**: Call `POST /runs/external` with `{ taskId, source: "codex" }` (or "claude"/"openclaw" as appropriate). Use `Authorization: Bearer <token>`.
2. **Store runId**: Save the returned `runId`; use it for all subsequent calls.
3. **Emit chunks**: As you execute (run commands, read files, log progress), call `POST /runs/:runId/chunks` with a `StreamChunk` in the body. See [references/api.md](references/api.md) for chunk types.
4. **Signal done**: When execution completes, call `POST /runs/:runId/done` with optional `{ result, chunks }`.

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
