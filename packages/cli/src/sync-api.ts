/**
 * Sync API: start run, send chunks, done.
 * Uses getCredentials() so env or CLI config is used. API key authenticates the user
 * and is scoped to a project on the server (no projectId in request).
 */

import { getCredentials } from "./config.js";
import { loadRunState, saveRunState, clearRunState } from "./sync-state.js";

const SOURCE = process.env.AGENTOS_SOURCE || "claude";

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const { apiKey, apiUrl } = getCredentials();
  if (!apiKey) {
    throw new Error(
      "No AgentOS API key. Set AGENTOS_API_KEY or run: agentos auth set"
    );
  }
  const url = `${apiUrl.replace(/\/$/, "")}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AgentOS API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json() as Promise<unknown>;
}

interface ExternalRunResponse {
  runId?: string;
  taskId?: string;
  status?: string;
}

export async function syncStart(args: string[]): Promise<void> {
  const title = args[0] ? args.join(" ") : "External sync";
  const data = (await api("POST", "/runs/external", {
    source: SOURCE,
    title,
  })) as ExternalRunResponse;
  if (!data?.runId) throw new Error("Invalid response: missing runId");
  saveRunState(data.runId, data.taskId ?? "");
  console.log(JSON.stringify({ runId: data.runId, taskId: data.taskId }));
}

export async function syncChunk(args: string[]): Promise<void> {
  const raw = args[0];
  if (!raw) {
    throw new Error("Usage: agentos sync chunk '<json>'");
  }
  let chunk: unknown;
  try {
    chunk = JSON.parse(raw);
  } catch {
    throw new Error("chunk must be valid JSON");
  }
  const state = loadRunState();
  if (!state?.runId) {
    throw new Error("No active run. Run 'agentos sync start <title>' first.");
  }
  await api("POST", `/runs/${state.runId}/chunks`, { chunk });
}

export async function syncDone(args: string[]): Promise<void> {
  const summary = args.length ? args.join(" ") : "";
  const state = loadRunState();
  if (!state?.runId) {
    throw new Error("No active run. Run 'agentos sync start <title>' first.");
  }
  await api("POST", `/runs/${state.runId}/done`, { result: summary });
  clearRunState();
  console.log("Run completed. Task is in Review.");
}
