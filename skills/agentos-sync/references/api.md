# AgentOS External Sync API

Base URL: `AGENTOS_API_URL` or `http://localhost:4000`

Auth: `Authorization: Bearer <access_token>` (user JWT from AgentOS)

## Endpoints

### POST /runs/external

Register an external run and get a runId for streaming. Either link to an existing task or create a new one.

**Request (create new task):**
```json
{
  "projectId": "uuid",
  "source": "codex" | "claude" | "openclaw",
  "title": "optional task title",
  "agentId": "uuid (optional)"
}
```

**Request (link to existing task):**
```json
{
  "taskId": "uuid",
  "source": "codex" | "claude" | "openclaw",
  "agentId": "uuid (optional)"
}
```

When `projectId` is provided, a new task is created with status "AI Working" and title "External sync from {source}" (or custom `title`). The run streams to that task's execution console.

**Response:**
```json
{
  "runId": "uuid",
  "taskId": "uuid",
  "status": "running"
}
```

### POST /runs/:runId/chunks

Push a stream chunk. Broadcasts to WebSocket subscribers (AgentOS app).

**Request:**
```json
{
  "chunk": {
    "type": "text" | "section" | "command" | "read_file" | "user_prompt" | "agent_log",
    ...
  }
}
```

**Chunk schemas:**

- `{ type: "text", content: string }`
- `{ type: "section", title: string, content?: string }`
- `{ type: "command", command: string, output?: string, status?: "running"|"done"|"error" }`
- `{ type: "read_file", path: string, summary?: string, tokens?: number }`
- `{ type: "write_file", path: string, content?: string }` — file creation or edit; content is an optional snippet/diff/summary
- `{ type: "user_prompt", message: string }`
- `{ type: "agent_log", level: string, message: string, payload?: object }`

**Response:** 204 No Content

### POST /runs/:runId/done

Signal run completion. Persists execution log and updates task status.

**Request:**
```json
{
  "result": "optional summary",
  "output": "optional full output (e.g., diff, file previews)",
  "chunks": [ /* optional full chunk array for persistence */ ]
}
```

If `chunks` is omitted, AgentOS will persist the buffered stream chunks it already received for the run.

**Response:**
```json
{ "ok": true }
```

## Example Flow (script)

```bash
# 1. Start — creates task in AgentOS, saves runId to temp file
node scripts/sync-to-agentos.js start "Fix authentication bug"

# 2. Emit chunks throughout execution
node scripts/sync-to-agentos.js chunk '{"type":"section","title":"Planning","content":"Analyzing the issue"}'
node scripts/sync-to-agentos.js chunk '{"type":"read_file","path":"src/auth.ts","summary":"Auth middleware, 80 lines"}'
node scripts/sync-to-agentos.js chunk '{"type":"command","command":"npm test","output":"3 failures in auth.test.ts","status":"done"}'
node scripts/sync-to-agentos.js chunk '{"type":"write_file","path":"src/auth.ts","content":"Fixed token expiry check"}'
node scripts/sync-to-agentos.js chunk '{"type":"command","command":"npm test","output":"All 42 tests passed","status":"done"}'

# 3. Done
node scripts/sync-to-agentos.js done "Fixed JWT token expiry validation in auth middleware"
```

## Example Flow (raw curl)

```bash
# 1. Create task and register (uses projectId from AGENTOS_PROJECT_ID)
curl -X POST "$API_URL/runs/external" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-uuid>","source":"claude","title":"Fix auth bug"}'
# -> { "runId": "...", "taskId": "...", "status": "running" }
# Task is created with "AI Working" status; open it in AgentOS to see the stream

# 2. Emit a log
curl -X POST "$API_URL/runs/$RUN_ID/chunks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chunk":{"type":"agent_log","level":"info","message":"Starting analysis"}}'

# 3. Emit a file write
curl -X POST "$API_URL/runs/$RUN_ID/chunks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chunk":{"type":"write_file","path":"src/auth.ts","content":"Fixed token expiry check"}}'

# 4. Emit a command
curl -X POST "$API_URL/runs/$RUN_ID/chunks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chunk":{"type":"command","command":"npm test","output":"All passed","status":"done"}}'

# 5. Done
curl -X POST "$API_URL/runs/$RUN_ID/done" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"result":"Analysis complete"}'
```
