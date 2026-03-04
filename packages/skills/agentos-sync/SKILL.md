---
name: agentos-sync
description: Sync execution logs and output to AgentOS. Use when the user wants to stream their Codex/Cursor/OpenClaw session to AgentOS for realtime visibility. Creates a task automatically, sets AI Working status, and streams all output to the execution console.
---

# AgentOS Sync

Stream execution logs and output from this session to AgentOS. A task is created automatically with "AI Working" status; all output appears in the AgentOS execution console in realtime.

## When to Use

- User asks to sync with AgentOS, stream to AgentOS, or show execution in AgentOS
- User wants their work visible in the AgentOS execution console

## Setup (one-time)

Set **AGENTOS_API_KEY** in the environment (shell profile or `.env`). Get the key from AgentOS → Settings → API Keys → Create API key (copy once; it is scoped to a project). Optionally set **AGENTOS_API_URL** (default `http://localhost:4000`).

If neither is set, tell the user once: "To sync with AgentOS, set AGENTOS_API_KEY (and optionally AGENTOS_API_URL). Get the API key from Settings → API Keys → Create API key in the web app. See the agentos-sync README."

**Do not invoke the CLI.** This skill calls the AgentOS API directly with the API key. No project ID or task ID needed—the key is scoped to a project on the server.

## Workflow

Call the **AgentOS API** directly. Base URL: `AGENTOS_API_URL` or `http://localhost:4000`. Auth: `Authorization: Bearer <AGENTOS_API_KEY>`. Full details: [references/api.md](references/api.md).

**1. Start run (create task)**  
`POST /runs/external` with JSON body, e.g.:

```json
{ "source": "cursor", "title": "Task title from user prompt" }
```

Use `source`: `"cursor"` | `"codex"` | `"claude"` | `"openclaw"` as appropriate. Response gives `runId` and `taskId`; store `runId` for this session.

**2. Stream chunks**  
`POST /runs/<runId>/chunks` with JSON body:

```json
{ "chunk": { "type": "section", "title": "Planning", "content": "Analyzing the request" } }
```

Emit chunks as you work. Examples:

- `{ "chunk": { "type": "command", "command": "npm test", "output": "All passed", "status": "done" } }`
- `{ "chunk": { "type": "text", "content": "Updated src/app.ts" } }`
- `{ "chunk": { "type": "read_file", "path": "src/index.ts", "summary": "Entry point" } }`
- `{ "chunk": { "type": "agent_log", "level": "info", "message": "Step complete" } }`

**3. Done**  
`POST /runs/<runId>/done` with JSON body, e.g.:

```json
{ "result": "Brief summary of what was accomplished" }
```

This persists the execution log and moves the task to Review.

## Chunk Types

Map your actions to these types:

- `agent_log` – General log line: `{ type: "agent_log", level: "info"|"warn"|"error", message, payload? }`
- `section` – Grouped output: `{ type: "section", title, content? }`
- `command` – Terminal command + output: `{ type: "command", command, output?, status?: "running"|"done"|"error" }`
- `read_file` – File read: `{ type: "read_file", path, summary?, tokens? }`
- `text` – Plain text: `{ type: "text", content }`
- `user_prompt` – When you need user input: `{ type: "user_prompt", message }`

## API URL

Default: `http://localhost:4000`. Override with `AGENTOS_API_URL` if the user's AgentOS instance is elsewhere.

For full API details, see [references/api.md](references/api.md).
