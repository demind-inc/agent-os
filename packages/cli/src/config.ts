/**
 * AgentOS CLI config: read/write API key so skills can use it.
 * Config file: AGENTOS_CONFIG_DIR/config.json (default ~/.agentos/config.json)
 * Only the API key is stored; project is scoped to the key on the server.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface AgentosConfig {
  apiKey?: string;
  apiUrl?: string;
}

export interface Credentials {
  apiKey: string | undefined;
  apiUrl: string;
}

const CONFIG_DIR =
  process.env.AGENTOS_CONFIG_DIR || join(homedir(), ".agentos");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): AgentosConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as AgentosConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentosConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Ensure URL has a scheme so fetch() works. Bare hostnames are treated as https.
 */
function normalizeApiUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  if (!u) return "https://agent-os-api-nine.vercel.app";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/**
 * Resolve credentials: env vars override config file.
 * API key is trimmed so .env newlines don't break Bearer auth.
 */
export function getCredentials(): Credentials {
  const config = loadConfig();
  const rawKey =
    process.env.AGENTOS_API_KEY ?? process.env.AGENTOS_KEY ?? config?.apiKey;
  const apiKey = typeof rawKey === "string" ? rawKey.trim() : undefined;
  const rawUrl =
    process.env.AGENTOS_API_URL ??
    config?.apiUrl ??
    "https://agent-os-api-nine.vercel.app";
  const apiUrl = normalizeApiUrl(rawUrl);
  return { apiKey, apiUrl };
}
