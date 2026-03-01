# AgentOS

AgentOS is a full-stack task management app for AI-assisted execution.

- Frontend: Next.js (`apps/web`)
- API: Fastify (`apps/api`)
- Backend data/auth/realtime: Supabase (`supabase`)

## Features

- Workspace and project onboarding
- Task CRUD with unified status workflow:
  - `backlog`
  - `ai_working`
  - `in_review`
  - `done`
  - `failed`
- Agent execution pipeline:
  - assign task -> choose agent/model -> run
  - run states: `queued`, `running`, `awaiting_input`, `completed`, `failed`
- Task detail includes:
  - overview
  - execution console (logs + tool usage)
  - artifact tracking
- Integrations scaffold (OAuth start/callback + sync job enqueue)
- Mandatory human review gate before final completion

## Monorepo Structure

```text
agentos/
├── apps/
│   ├── web/      # Next.js App Router
│   └── api/      # Fastify API
├── supabase/
│   ├── config.toml
│   └── migrations/
└── package.json
```

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (or Supabase local dev via CLI)

## Environment Variables

**Web app**  
Next.js loads `.env` from the **monorepo root** (`agentos/.env`). Copy the root example and fill in values:

```bash
cp .env.example .env
```

**API**  
The API loads `.env` from `apps/api/.env`:

```bash
cp apps/api/.env.example apps/api/.env
```

**Root `.env`** (used by the web app via `next.config`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (auth/realtime)
- `NEXT_PUBLIC_API_URL` — (default: `http://localhost:4000`) — Fastify API URL for the frontend

**`apps/api/.env`** (API only):

- `NEXT_PUBLIC_SUPABASE_URL` — same Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (never expose to the client)
- `API_PORT` — (default: `4000`)

Alternatively you can put web vars in `apps/web/.env` (see `apps/web/.env.example`); the root `.env` is loaded first so both work.

## Install

```bash
npm install
```

## Database Setup (Supabase)

Apply the migration in `supabase/migrations` to your Supabase project.

- If using Supabase CLI, link your project and run migration commands.
- The migration creates core tables, enums, RLS policies, onboarding trigger, and realtime publication entries.

## Run Locally

From repo root:

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

- Web app: `http://localhost:3000`
- API: `http://localhost:4000`

## Build

```bash
npm --workspace @agentos/api run build
npm --workspace @agentos/web run build
```

## Key API Routes

- `GET /health`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId/projects`
- `POST /workspaces/:workspaceId/projects`
- `GET /projects/:projectId/tasks`
- `POST /projects/:projectId/tasks`
- `PATCH /tasks/:taskId`
- `DELETE /tasks/:taskId`
- `POST /tasks/:taskId/run`
- `GET /projects/:projectId/runs`
- `GET /tasks/:taskId/logs`
- `GET /tasks/:taskId/artifacts`
- `POST /tasks/:taskId/review`
- `POST /integrations/oauth/start`
- `GET /integrations/oauth/callback`
- `POST /integrations/:integrationId/sync`
- `POST /workspaces/:workspaceId/skills`

## Notes

- OAuth callback is scaffolded and intended to be completed with provider token exchange logic.
- Agent runner is implemented as a simulation layer and can be extended with real Claude/Codex adapters.
