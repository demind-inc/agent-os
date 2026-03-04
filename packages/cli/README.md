# AgentOS CLI

CLI for **auth** and **sync**, used by the AgentOS sync skill (Codex, Cursor, Claude, OpenClaw). You set only the **API key** (issued in the web app); no OAuth token, project ID, or API URL required. Skills can then access AgentOS without logging in.

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

Only the **API key** is stored (and optional API URL). It is saved in `~/.agentos/config.json` (or `$AGENTOS_CONFIG_DIR/config.json`). Environment variables override the config file.

| Command               | Description                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `agentos auth set`    | Set API key (and optional API URL). Prompts for values not given as args or env.                      |
| `agentos auth status` | Show whether auth is configured (masked).                                                             |
| `agentos auth env`    | Print `export AGENTOS_API_KEY=...` etc. Use: `eval "$(agentos auth env)"` to load into current shell. |

**Getting the API key:** In AgentOS go to **Settings → API Keys → AgentOS API key (CLI & skills)** → choose a project → **Create API key**. Copy the key when shown (it is not shown again). Each key is scoped to one project.

## Sync

Start a run (creates a task in the project scoped to your API key), stream chunks, then mark done. The CLI reads the API key from env or from the config file, so skills can sync without the user setting env vars.

| Command                           | Description                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `agentos sync start "Task title"` | Create a task and register the run. Saves `runId` for this session (keyed by shell PID).            |
| `agentos sync chunk '<json>'`     | Send one chunk to the current run (e.g. section, command, agent_log, text, read_file, user_prompt). |
| `agentos sync done "Summary"`     | Finish the run and move the task to **Review**.                                                     |

Chunk types match the API: `text`, `section`, `command`, `read_file`, `user_prompt`, `agent_log`. See the skill’s [references/api.md](../skills/agentos-sync/references/api.md).

Set `AGENTOS_SOURCE` to `codex`, `cursor`, or `openclaw` if not using from Claude (default `claude`).

## Usage from skills

1. User creates an API key in the web app and runs `agentos auth set` once to store it.
2. Skill runs `agentos sync start "Title"`, then `agentos sync chunk '...'` as needed, then `agentos sync done "Summary"`.
3. The API key is read from `~/.agentos/config.json` when env vars are not set, so the skill has access to AgentOS after auth is set via CLI.
