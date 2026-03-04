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

**Option A — AgentOS CLI (recommended)**  
Install and configure the CLI with the API key issued in the web app:

```bash
npx @agentos/cli auth set
# Enter the API key from AgentOS → Settings → API Keys → Create API key (copy the key once; it is scoped to a project)
```

If `agentos` is not installed or not on PATH, either keep using `npx @agentos/cli ...` or install it globally:

```bash
npm i -g @agentos/cli
agentos auth set
```

Credentials are stored in `~/.agentos/config.json`. No OAuth token, project ID, or API URL needed—just the API key. When the user has run `agentos auth set`, the skill has access to AgentOS when it invokes `agentos sync` commands.

**Option B — Environment variable**  
Set `AGENTOS_API_KEY` in shell or `.env`; the CLI and skill use it if set. Optionally set `AGENTOS_API_URL` (default `http://localhost:4000`).

If neither CLI config nor env is set, tell the user once: "To sync with AgentOS, run `agentos auth set` or set AGENTOS_API_KEY. Get the API key from Settings → API Keys → Create API key in the web app. See the agentos-sync README."

## Workflow

Use the **AgentOS CLI** (same binary that manages auth). The CLI reads credentials from env or from `~/.agentos/config.json`:

```bash
# 1. Start — creates task in AgentOS, saves runId for this session
agentos sync start "Task title from user prompt"

# 2. Stream chunks throughout execution
agentos sync chunk '{"type":"section","title":"Planning","content":"Analyzing the request"}'
agentos sync chunk '{"type":"command","command":"npm test","output":"All passed","status":"done"}'
agentos sync chunk '{"type":"text","content":"Updated src/app.ts"}'
agentos sync chunk '{"type":"read_file","path":"src/index.ts","summary":"Entry point"}'
agentos sync chunk '{"type":"agent_log","level":"info","message":"Step complete"}'

# 3. Done — moves task to Review
agentos sync done "Brief summary of what was accomplished"
```

If the CLI is not installed, you can call the API directly (see [references/api.md](references/api.md)) using `Authorization: Bearer <AGENTOS_API_KEY>`. The API key is scoped to a project on the server; do not ask the user for task ID or project ID in chat.

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
