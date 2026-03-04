#!/usr/bin/env node

/**
 * AgentOS CLI — auth and sync for skills.
 * Usage: agentos auth set | status | env
 *        agentos sync start <title> | chunk <json> | done [summary]
 */

import {
  loadConfig,
  saveConfig,
  getCredentials,
  getConfigPath,
} from "./config.js";
import { syncStart, syncChunk, syncDone } from "./sync-api.js";

const args = process.argv.slice(2);
const cmd = args[0];
const sub = args[1];

function usage(): void {
  console.log(`
AgentOS CLI — auth and sync for Codex/Cursor/Claude skills

  agentos auth set              Set API key (access token), project ID, and API URL
  agentos auth status           Show whether auth is configured (masked)
  agentos auth env              Print export statements for current shell (eval "$(agentos auth env)")

  agentos sync start <title>    Start a sync run (creates task in AgentOS)
  agentos sync chunk <json>     Send a chunk to the current run
  agentos sync done [summary]   Finish the run and move task to Review

Credentials: use AGENTOS_ACCESS_TOKEN and AGENTOS_PROJECT_ID in env, or run 'agentos auth set'.
Config file: ${getConfigPath()}
`);
}

async function main(): Promise<void> {
  if (!cmd) {
    usage();
    process.exit(1);
  }

  if (cmd === "auth") {
    if (sub === "set") {
      await authSet(args.slice(2));
    } else if (sub === "status") {
      authStatus();
    } else if (sub === "env") {
      authEnv();
    } else {
      console.error("Usage: agentos auth set | status | env");
      process.exit(1);
    }
    return;
  }

  if (cmd === "sync") {
    if (sub === "start") {
      await syncStart(args.slice(2));
    } else if (sub === "chunk") {
      await syncChunk(args.slice(2));
    } else if (sub === "done") {
      await syncDone(args.slice(2));
    } else {
      console.error(
        "Usage: agentos sync start <title> | chunk <json> | done [summary]"
      );
      process.exit(1);
    }
    return;
  }

  console.error("Unknown command:", cmd);
  usage();
  process.exit(1);
}

async function authSet(rest: string[]): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q: string): Promise<string> =>
    new Promise((res) => rl.question(q, res));

  let accessToken = rest[0] || process.env.AGENTOS_ACCESS_TOKEN;
  let projectId = rest[1] || process.env.AGENTOS_PROJECT_ID;
  let apiUrl = rest[2] || process.env.AGENTOS_API_URL;

  if (!accessToken)
    accessToken = (
      await ask("AgentOS access token (from Settings → API Keys): ")
    ).trim();
  if (!accessToken) {
    console.error("Access token is required.");
    rl.close();
    process.exit(1);
  }
  if (!projectId)
    projectId = (await ask("Project ID (from Settings → API Keys): ")).trim();
  if (!apiUrl)
    apiUrl =
      (await ask("API URL [http://localhost:4000]: ")).trim() ||
      "http://localhost:4000";

  rl.close();

  saveConfig({
    accessToken,
    projectId: projectId || undefined,
    apiUrl,
  });
  console.log("Auth saved to", getConfigPath());
  console.log(
    "Skills can now use AgentOS when they run 'agentos sync' (credentials are read from this config if env vars are not set)."
  );
}

function authStatus(): void {
  const creds = getCredentials();
  const fromConfig = loadConfig();
  if (!creds.token) {
    console.log("Not configured. Run: agentos auth set");
    process.exit(1);
  }
  console.log("Configured (token and project ID set).");
  if (fromConfig) console.log("Source: config file", getConfigPath());
  else console.log("Source: environment variables");
}

function authEnv(): void {
  const creds = getCredentials();
  if (!creds.token || !creds.projectId) {
    console.error("Not configured. Run: agentos auth set");
    process.exit(1);
  }
  console.log(
    `export AGENTOS_ACCESS_TOKEN="${creds.token.replace(/"/g, '\\"')}"`
  );
  console.log(`export AGENTOS_PROJECT_ID="${creds.projectId}"`);
  console.log(`export AGENTOS_API_URL="${creds.apiUrl}"`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
