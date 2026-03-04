# AgentOS CLI

CLI for **auth** and **sync**, used by the AgentOS sync skill (Codex, Cursor, Claude, OpenClaw). When you set credentials via the CLI, skills can access AgentOS without environment variables.

## Install

From the monorepo (TypeScript; build first):

```bash
cd packages/cli
npm install
npm run build
npm link
# or from repo root: npm run cli -- auth set
```

Or from another project:

```bash
npm install -g @agentos/cli
# or
npx @agentos/cli auth set
```

## Auth

Credentials are stored in `~/.agentos/config.json` (or `$AGENTOS_CONFIG_DIR/config.json`). Environment variables override the config file.

| Command | Description |
|--------|-------------|
| `agentos auth set` | Set API key (access token), project ID, and API URL. Prompts for values not given as args or env. |
| `agentos auth status` | Show whether auth is configured (masked). |
| `agentos auth env` | Print `export AGENTOS_ACCESS_TOKEN=...` etc. Use: `eval "$(agentos auth env)"` to load into current shell. |

**Getting credentials:** In AgentOS go to **Settings → API Keys → External Sync**. Copy the access token and project ID (open the app board first so the project is set).

## Sync

Same behavior as the existing sync workflow: start a run (creates a task in AgentOS), stream chunks, then mark done. The CLI reads credentials from env or from the config file written by `agentos auth set`, so skills can sync without the user setting env vars.

| Command | Description |
|--------|-------------|
| `agentos sync start "Task title"` | Create a task and register the run. Saves `runId` for this session (keyed by shell PID). |
| `agentos sync chunk '<json>'` | Send one chunk to the current run (e.g. section, command, agent_log, text, read_file, user_prompt). |
| `agentos sync done "Summary"` | Finish the run and move the task to **Review**. |

Chunk types match the API: `text`, `section`, `command`, `read_file`, `user_prompt`, `agent_log`. See the skill’s [references/api.md](../../skills/agentos-sync/references/api.md).

Set `AGENTOS_SOURCE` to `codex`, `cursor`, or `openclaw` if not using from Claude (default `claude`).

## Usage from skills

1. User runs `agentos auth set` once and enters token + project ID.
2. Skill runs `agentos sync start "Title"`, then `agentos sync chunk '...'` as needed, then `agentos sync done "Summary"`.
3. Credentials are read from `~/.agentos/config.json` when env vars are not set, so the skill has access to AgentOS after auth is set via CLI.
