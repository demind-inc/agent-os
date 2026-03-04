# AgentOS Sync Skill

Stream execution logs and output from Codex, Cursor, Claude, or OpenClaw to AgentOS for realtime visibility in the app.

## Prerequisites

- An AgentOS instance (default: `http://localhost:4000`)
- **Auth:** Use an **API key** (no OAuth token). Either:
  - **CLI:** Run `agentos auth set` and enter the API key from Settings → API Keys → Create API key (each key is scoped to one project). Stored in `~/.agentos/config.json`.
  - **Env:** Set **AGENTOS_API_KEY** in your environment.

**No chat prompts:** The skill creates tasks automatically and streams to the execution console. No task ID or project ID needed—the API key is scoped to a project on the server.

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
        "apiKey": "${AGENTOS_API_KEY}"
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

## Getting Your API Key

The API key lets the CLI and skills call the AgentOS API without logging in. Each key is scoped to one project (chosen when you create the key).

**From Settings:** Settings → API Keys → **AgentOS API key (CLI & skills)** → choose a project and click **Create API key**. Copy the key immediately—it is shown only once.

**Security:** Treat the API key like a password. Do not commit it to git or share it. You can revoke keys from Settings at any time.

### API URL (`AGENTOS_API_URL`)

- **Local dev:** `http://localhost:4000` (default)
- **Deployed:** Use your API base URL (e.g. `https://api.your-agentos.com`)

---

## Configuration

**Option 1 — AgentOS CLI (recommended)**  
Install the CLI from this repo (`packages/cli`) and run once:

```bash
npx @agentos/cli auth set
# Enter the API key from Settings → API Keys → Create API key
```

The API key is saved to `~/.agentos/config.json`. The skill uses it when it runs `agentos sync start`, `agentos sync chunk`, and `agentos sync done`. No OAuth token or project ID needed.

**Option 2 — Environment variable**

| Variable          | Description              | Default                 |
| ----------------- | ------------------------ | ----------------------- |
| `AGENTOS_API_KEY` | API key from web app     | Required (or use CLI)   |
| `AGENTOS_API_URL`| AgentOS API base URL     | `http://localhost:4000` |

**Codex / Cursor / Claude:** Add to shell profile or `.env`, or use `agentos auth set`:

```bash
export AGENTOS_API_KEY="ag_your-key-here"
export AGENTOS_API_URL="http://localhost:4000"
```

**OpenClaw:** Use `AGENTOS_API_KEY` in config; set env var before starting or use the CLI config.

---

## Usage

1. **Set API key** (one-time): Create an API key in Settings → API Keys, then run `agentos auth set` or set `AGENTOS_API_KEY`.
2. In your agent (Codex/Cursor/Claude/OpenClaw), ask to sync with AgentOS.
3. The skill creates a task with "AI Working" status and streams all output to the execution console.
4. Open AgentOS and view the new task to see realtime logs.

**Realtime streaming:** A task is created automatically when the external agent starts. Open the task in AgentOS to see the stream. Chunks sent before you open the task are buffered and replayed when you connect. When the run completes, the full execution log is saved to the task.

Invoke explicitly: type `/agentos-sync` (or `$agentos-sync` in Codex).
