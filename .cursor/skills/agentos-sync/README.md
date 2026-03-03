# AgentOS Sync Skill

Stream execution logs and output from Codex, Cursor, Claude, or OpenClaw to AgentOS for realtime visibility in the app.

## Prerequisites

- An AgentOS instance (default: `http://localhost:4000`)
- **AGENTOS_ACCESS_TOKEN** — from Settings → API Keys → Copy access token (refreshes session; no expired tokens)
- **AGENTOS_PROJECT_ID** — from Settings → API Keys → Copy project ID (open the app board first to set it)

**No chat prompts:** Set both in your environment. The skill creates tasks automatically and streams to the execution console. No task ID or project ID needed in chat.

---

## Installation by Platform

### Codex (OpenAI)

Codex reads skills from `$CODEX_HOME/skills` (default `~/.codex/skills`), `.agents/skills` in your repo, or `~/.agents/skills`.

**Option 1: Install from this repo (recommended)**

In Codex chat, use the skill installer:

```
$skill-installer install the agentos-sync skill from demind-inc/agent-os, path skills/agentos-sync
```

Or if this repo is cloned locally:

```bash
# Copy into Codex user skills directory
cp -r /path/to/agentos/skills/agentos-sync ~/.codex/skills/
```

**Option 2: Install from GitHub**

```
$skill-installer install from demind-inc/agent-os, path skills/agentos-sync
```

Restart Codex after installing.

---

### Cursor

Cursor loads skills from `.agents/skills/`, `.cursor/skills/`, or `~/.cursor/skills/`. It also reads from `~/.claude/skills/` and `~/.codex/skills/` for compatibility.

**Option 1: Project-level (recommended)**

```bash
mkdir -p .cursor/skills
cp -r /path/to/agentos/skills/agentos-sync .cursor/skills/
```

**Option 2: User-level (global)**

```bash
mkdir -p ~/.cursor/skills
cp -r /path/to/agentos/skills/agentos-sync ~/.cursor/skills/
```

**Option 3: From GitHub**

1. Open Cursor Settings (Cmd+Shift+J or Ctrl+Shift+J)
2. Go to Rules
3. Click Add Rule → Remote Rule (Github)
4. Enter the GitHub repo URL and path: `https://github.com/demind-inc/agent-os/tree/main/skills/agentos-sync`

Restart Cursor to pick up the new skill.

---

### Claude (Claude Code / Claude Desktop)

Claude Code and compatible tools read skills from `~/.claude/skills/` or `.claude/skills/` in your project.

**User-level (global):**

```bash
mkdir -p ~/.claude/skills
cp -r /path/to/agentos/skills/agentos-sync ~/.claude/skills/
```

**Project-level:**

```bash
mkdir -p .claude/skills
cp -r /path/to/agentos/skills/agentos-sync .claude/skills/
```

Restart Claude Code after installing.

---

### OpenClaw

OpenClaw stores skills in your workspace’s `skills/` directory. Skills follow the AgentSkills format (SKILL.md).

**Manual installation:**

```bash
# From your OpenClaw workspace root
mkdir -p skills
cp -r /path/to/agentos/skills/agentos-sync skills/
```

Register the skill in `openclaw.json`:

```json
{
  "skills": {
    "agentos-sync": {
      "enabled": true,
      "config": {
        "apiUrl": "${AGENTOS_API_URL}",
        "accessToken": "${AGENTOS_ACCESS_TOKEN}",
        "projectId": "${AGENTOS_PROJECT_ID}"
      }
    }
  }
}
```

If OpenClaw supports ClawHub and this skill is published there, you can also use:

```
/skills install @demind-inc/agentos-sync
```

---

## Getting Your Credentials

### Access Token (`AGENTOS_ACCESS_TOKEN`)

The access token is your AgentOS session JWT. You need it to authenticate API calls from external agents.

**From Settings:** Settings → API Keys → External Sync → **Copy access token**. The button refreshes your session first and only copies a valid, non-expired token. If your session is expired, log in again.

### Project ID (`AGENTOS_PROJECT_ID`)

The project UUID where tasks are created. External agents create new tasks in this project.

**From Settings:** Open the app board first (so the project is set), then Settings → API Keys → External Sync → **Copy project ID**.

**Security:** Treat the token like a password. It expires when your session ends. Do not commit it to git or share it.

### API URL (`AGENTOS_API_URL`)

- **Local dev:** `http://localhost:4000` (default)
- **Deployed:** Use your API base URL (e.g. `https://api.your-agentos.com`)

---

## Configuration

Set these environment variables. No chat prompts—the skill creates tasks and streams automatically.

| Variable               | Description                    | Default                 |
| ---------------------- | ------------------------------ | ----------------------- |
| `AGENTOS_ACCESS_TOKEN` | Your AgentOS JWT               | Required                |
| `AGENTOS_PROJECT_ID`  | Project UUID for new tasks     | Required                |
| `AGENTOS_API_URL`      | AgentOS API base URL           | `http://localhost:4000` |

**Codex / Cursor / Claude:** Add to shell profile or `.env`:

```bash
export AGENTOS_ACCESS_TOKEN="your-token-here"
export AGENTOS_PROJECT_ID="your-project-uuid"
export AGENTOS_API_URL="http://localhost:4000"
```

**OpenClaw:** Use `${AGENTOS_ACCESS_TOKEN}` and `${AGENTOS_PROJECT_ID}` in config; set env vars before starting.

---

## Usage

1. **Set env vars** (one-time): `AGENTOS_ACCESS_TOKEN` and `AGENTOS_PROJECT_ID` from Settings → API Keys.
2. In your agent (Codex/Cursor/Claude/OpenClaw), ask to sync with AgentOS **or include `#agentos` in the first prompt**.
3. The skill creates a task with "AI Working" status and streams all output to the execution console.
4. When the chat finishes, the agent calls `/runs/:runId/done`, moving the task to **Review**.
5. Open AgentOS and view the new task to see realtime logs.

**Realtime streaming:** A task is created automatically when the external agent starts. Open the task in AgentOS to see the stream. Chunks sent before you open the task are buffered and replayed when you connect. When the run completes, the full execution log is saved to the task.

Invoke explicitly: type `/agentos-sync` (or `$agentos-sync` in Codex). You can also auto-enable by including `#agentos` in the first prompt.
