# AgentOS Sync Skill

Stream execution logs and output from Codex, Cursor, Claude, or OpenClaw to AgentOS for realtime visibility in the app.

## Prerequisites

- An AgentOS instance (default: `http://localhost:4000`)
- An AgentOS access token (Settings → API Keys → Copy access token)
- A task ID in AgentOS to link the session to

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
        "accessToken": "${AGENTOS_ACCESS_TOKEN}"
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

**Option 1: From Settings (recommended)**

1. Log in to AgentOS.
2. Go to **Settings** → **API Keys**.
3. Scroll to **External Sync (Codex, Cursor, Claude, OpenClaw)**.
4. Click **Copy access token**.

**Option 2: From the browser**

1. Log in to AgentOS in your browser.
2. Open DevTools (F12 or right-click → Inspect).
3. Go to **Application** (Chrome) or **Storage** (Firefox) → **Local Storage**.
4. Select your AgentOS origin (e.g. `http://localhost:3000`).
5. Find the key `agentos_access_token` and copy its value.

**Option 3: From the console**

1. Log in to AgentOS.
2. Open DevTools → **Console**.
3. Run: `copy(localStorage.getItem('agentos_access_token'))`
4. The token is now in your clipboard.

**Security:** Treat the token like a password. It expires when your session ends. Do not commit it to git or share it.

### API URL (`AGENTOS_API_URL`)

- **Local dev:** `http://localhost:4000` (default)
- **Deployed:** Use your API base URL (e.g. `https://api.your-agentos.com`)

---

## Configuration by Platform

Set these environment variables so the agent can call the AgentOS API:

| Variable               | Description          | Default                 |
| ---------------------- | -------------------- | ----------------------- |
| `AGENTOS_ACCESS_TOKEN` | Your AgentOS JWT     | Required                |
| `AGENTOS_API_URL`      | AgentOS API base URL | `http://localhost:4000` |

### Codex

Add to your shell profile (`~/.zshrc`, `~/.bashrc`) or Codex config:

```bash
export AGENTOS_ACCESS_TOKEN="your-token-here"
export AGENTOS_API_URL="http://localhost:4000"   # optional
```

Or in `~/.codex/config.toml` (if Codex supports env passthrough), ensure the process inherits these env vars. Codex typically inherits from the terminal where it was launched.

### Cursor

**Project-level:** Create `.env` in your project root (add to `.gitignore`):

```
AGENTOS_ACCESS_TOKEN=your-token-here
AGENTOS_API_URL=http://localhost:4000
```

**User-level:** Add to `~/.zshrc` or `~/.bashrc` so Cursor’s integrated terminal has them.

### Claude (Claude Code / Claude Desktop)

Add to your shell profile so the agent process can read them:

```bash
export AGENTOS_ACCESS_TOKEN="your-token-here"
export AGENTOS_API_URL="http://localhost:4000"
```

### OpenClaw

Use `openclaw.json` with env var references:

```json
{
  "skills": {
    "agentos-sync": {
      "enabled": true,
      "config": {
        "apiUrl": "${AGENTOS_API_URL}",
        "accessToken": "${AGENTOS_ACCESS_TOKEN}"
      }
    }
  }
}
```

Then set the variables before starting OpenClaw:

```bash
export AGENTOS_ACCESS_TOKEN="your-token-here"
export AGENTOS_API_URL="http://localhost:4000"
openclaw
```

Or use OpenClaw’s secrets (if available): `/secrets set AGENTOS_ACCESS_TOKEN your-token-here`

### Providing the token when prompted

If env vars are not set, the agent can ask you for the token when you invoke the skill. You can paste it when prompted. Avoid pasting it into shared or logged channels.

---

## Usage

1. **Open the task in AgentOS** and copy its task ID (UUID). Keep the task detail panel open to see realtime logs.
2. In your agent (Codex/Cursor/Claude/OpenClaw), ask to sync with AgentOS and provide the task ID.
3. The agent will register the session, stream chunks as it works, and signal done when finished.
4. Watch the execution console in AgentOS in realtime.

**Realtime streaming:** The app receives logs via WebSocket. Open the task in AgentOS before or during the external agent's execution. Chunks sent before you open the task are buffered and replayed when you connect. When the run completes, the full execution log is also saved to the task for later viewing.

You can also invoke explicitly: type `/agentos-sync` (or `$agentos-sync` in Codex) and provide the task ID when prompted.
