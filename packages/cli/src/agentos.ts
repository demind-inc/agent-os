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

  agentos auth set              Set API key (from Settings → API Keys in the web app)
  agentos auth status           Show whether auth is configured (masked)
  agentos auth env              Print export AGENTOS_API_KEY=... for current shell

  agentos sync start <title>    Start a sync run (creates task in AgentOS)
  agentos sync chunk <json>     Send a chunk to the current run
  agentos sync done [summary]   Finish the run and move task to Review

Credentials: set AGENTOS_API_KEY in env, or run 'agentos auth set' to store the API key.
The API key is issued in the web app (Settings → API Keys → Create API key). No OAuth token needed.
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

  let apiKey =
    rest[0] || process.env.AGENTOS_API_KEY || process.env.AGENTOS_KEY;
  let apiUrl = rest[1] || "https://agent-os-api-nine.vercel.app";

  if (!apiKey)
    apiKey = (
      await ask("AgentOS API key (from Settings → API Keys → Create API key): ")
    ).trim();
  if (!apiKey) {
    console.error("API key is required.");
    rl.close();
    process.exit(1);
  }
  if (!apiUrl)
    apiUrl =
      (await ask("API URL [http://localhost:4000]: ")).trim() ||
      "http://localhost:4000";

  rl.close();

  saveConfig({ apiKey, apiUrl });
  console.log("Auth saved to", getConfigPath());
  console.log(
    "Skills can now use AgentOS when they run 'agentos sync' (no OAuth token needed)."
  );
}

function authStatus(): void {
  const creds = getCredentials();
  const fromConfig = loadConfig();
  if (!creds.apiKey) {
    console.log("Not configured. Run: agentos auth set");
    process.exit(1);
  }
  console.log("Configured (API key set).");
  if (fromConfig) console.log("Source: config file", getConfigPath());
  else console.log("Source: environment variables");
}

function authEnv(): void {
  const creds = getCredentials();
  if (!creds.apiKey) {
    console.error("Not configured. Run: agentos auth set");
    process.exit(1);
  }
  console.log(`export AGENTOS_API_KEY="${creds.apiKey.replace(/"/g, '\\"')}"`);
  console.log(`export AGENTOS_API_URL="${creds.apiUrl}"`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
