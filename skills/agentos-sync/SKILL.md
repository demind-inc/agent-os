---
name: agentos-sync
description: Sync execution logs and output to AgentOS. Use when the user wants to stream their Claude Code/Codex/Cursor/OpenClaw session to AgentOS for realtime visibility. Creates a task automatically, sets AI Working status, and streams all output to the execution console.
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
2. **AGENTOS_PROJECT_ID** (required): Project UUID where tasks are created. User gets it from AgentOS → Settings → API Keys → Copy project ID.
3. **AGENTOS_API_URL** (optional): Default `http://localhost:4000`.

If env vars are not set, tell the user once: "To sync with AgentOS, set AGENTOS_ACCESS_TOKEN and AGENTOS_PROJECT_ID in your environment. See the agentos-sync README for setup."

## Workflow

### Option A — Script-based (recommended for Claude Code, Codex, Cursor)

Use the bundled script which manages session state automatically:

```bash
# 1. Start — creates task in AgentOS, saves runId to temp file
node scripts/sync-to-agentos.js start "Task title from user prompt"

# 2. Stream chunks throughout execution
node scripts/sync-to-agentos.js chunk '{"type":"section","title":"Planning","content":"Analyzing the request"}'
node scripts/sync-to-agentos.js chunk '{"type":"command","command":"npm test","output":"All passed","status":"done"}'
node scripts/sync-to-agentos.js chunk '{"type":"write_file","path":"src/app.ts","content":"// updated"}'
node scripts/sync-to-agentos.js chunk '{"type":"read_file","path":"src/index.ts","summary":"Entry point"}'
node scripts/sync-to-agentos.js chunk '{"type":"agent_log","level":"info","message":"Step complete"}'

# 3. Done — moves task to Review
node scripts/sync-to-agentos.js done "Brief summary of what was accomplished"
```

### Option B — Direct API calls

1. **Create task and register session**: `POST /runs/external`
   - Body: `{ "projectId": "<AGENTOS_PROJECT_ID>", "source": "claude", "title": "task title" }`
   - Auth: `Authorization: Bearer <AGENTOS_ACCESS_TOKEN>`
   - Response: `{ "runId": "uuid", "taskId": "uuid" }`
   - Task is created with "AI Working" status

2. **Stream chunks**: `POST /runs/:runId/chunks`
   - Body: `{ "chunk": { ...StreamChunk } }`

3. **Signal done**: `POST /runs/:runId/done`
   - Body: `{ "result": "summary" }`
   - Moves task to **Review** status

For full API details, see [references/api.md](references/api.md).

## Chunk Type Reference

Map your actions to these chunk types:

| Action | Chunk type | Fields |
|--------|------------|--------|
| Section / phase header | `section` | `title`, `content?` |
| Terminal command | `command` | `command`, `output?`, `status?` |
| Reading a file | `read_file` | `path`, `summary?`, `tokens?` |
| Writing / editing a file | `write_file` | `path`, `content?` |
| Log message | `agent_log` | `level`, `message`, `payload?` |
| Plain text | `text` | `content` |
| Need user input | `user_prompt` | `message` |

## Status Rules

- Task stays **AI Working** while the agent is executing — keep emitting chunks
- Call `done` only when all work is complete — task then moves to **Review**
- The user can then approve or reject the task in AgentOS

## Script

See `scripts/sync-to-agentos.js`. The script maintains session state in a temp file (keyed to your parent PID) so `start` is called once per session and all subsequent `chunk`/`done` calls reuse the same run.
