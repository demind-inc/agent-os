#!/usr/bin/env node
/**
 * AgentOS Sync Script
 *
 * Streams the current agent session to AgentOS dashboard.
 * Maintains session state in a temp file so start/chunk/done
 * all share the same run across multiple invocations.
 *
 * Usage:
 *   node scripts/sync-to-agentos.js start "Task title"
 *   node scripts/sync-to-agentos.js chunk '{"type":"agent_log","level":"info","message":"Step done"}'
 *   node scripts/sync-to-agentos.js chunk '{"type":"command","command":"npm test","output":"passed","status":"done"}'
 *   node scripts/sync-to-agentos.js chunk '{"type":"write_file","path":"src/app.ts","content":"// changes"}'
 *   node scripts/sync-to-agentos.js chunk '{"type":"read_file","path":"src/app.ts","summary":"Entry point"}'
 *   node scripts/sync-to-agentos.js done "Task completed successfully"
 *
 * Env vars:
 *   AGENTOS_ACCESS_TOKEN  - Required. Your AgentOS JWT (from Settings → API Keys).
 *   AGENTOS_PROJECT_ID    - Required for `start`. Project UUID for new tasks.
 *   AGENTOS_API_URL       - Optional. Default: http://localhost:4000
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ACCESS_TOKEN = process.env.AGENTOS_ACCESS_TOKEN;
const PROJECT_ID = process.env.AGENTOS_PROJECT_ID;
const API_URL = (process.env.AGENTOS_API_URL || "http://localhost:4000").replace(/\/$/, "");

// Session file is keyed to the parent process PID so the whole agent session
// (which shares a parent) reuses the same AgentOS run.
const SESSION_FILE = path.join(
  os.tmpdir(),
  `agentos-session-${process.ppid || process.pid}.json`
);

function readSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    }
  } catch (_) {
    // corrupt file — treat as missing
  }
  return null;
}

function writeSession(session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session), "utf-8");
}

function clearSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch (_) {
    // already gone — fine
  }
}

async function apiPost(endpoint, body) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return {};
}

async function main() {
  const [, , command, ...args] = process.argv;

  // Always fail silently so we never block the agent
  if (!ACCESS_TOKEN) {
    console.error(
      "[agentos] AGENTOS_ACCESS_TOKEN not set — skipping sync. Set it to stream to AgentOS."
    );
    process.exit(0);
  }

  // ── start ─────────────────────────────────────────────────────────────────
  if (command === "start") {
    if (!PROJECT_ID) {
      console.error(
        "[agentos] AGENTOS_PROJECT_ID not set — skipping sync. Set it to create tasks in AgentOS."
      );
      process.exit(0);
    }

    const title = args.join(" ").trim() || "External sync from Claude";

    // Clear any stale session from a previous run
    clearSession();

    const data = await apiPost("/runs/external", {
      projectId: PROJECT_ID,
      source: "claude",
      title,
    });

    writeSession({ runId: data.runId, taskId: data.taskId });

    console.log(`[agentos] Started → taskId=${data.taskId} runId=${data.runId}`);
    console.log(`[agentos] Open AgentOS to see live progress`);
    return;
  }

  // All other commands need an active session
  const session = readSession();
  if (!session) {
    // No session — call `start` first, or this is a leftover call; silent exit
    process.exit(0);
  }

  // ── chunk ─────────────────────────────────────────────────────────────────
  if (command === "chunk") {
    let chunk;
    try {
      chunk = JSON.parse(args[0] || "{}");
    } catch (_) {
      // If JSON parse fails, treat the whole arg list as plain text
      chunk = { type: "text", content: args.join(" ") };
    }

    await apiPost(`/runs/${session.runId}/chunks`, { chunk });
    return;
  }

  // ── done ──────────────────────────────────────────────────────────────────
  if (command === "done") {
    const result = args.join(" ").trim() || undefined;
    await apiPost(`/runs/${session.runId}/done`, { result });
    clearSession();
    console.log("[agentos] Done — task moved to Review in AgentOS");
    return;
  }

  console.error(
    `[agentos] Unknown command: "${command}". Valid commands: start | chunk | done`
  );
}

main().catch((err) => {
  // Always silent — never block the agent on a sync error
  console.error(`[agentos] Sync error (ignored): ${err.message}`);
  process.exit(0);
});
