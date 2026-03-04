/**
 * AgentOS CLI config: read/write credentials so skills can use them.
 * Config file: AGENTOS_CONFIG_DIR/config.json (default ~/.agentos/config.json)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface AgentosConfig {
  accessToken?: string;
  projectId?: string;
  apiUrl?: string;
}

export interface Credentials {
  token: string | undefined;
  projectId: string | undefined;
  apiUrl: string;
}

const CONFIG_DIR = process.env.AGENTOS_CONFIG_DIR || join(homedir(), ".agentos");
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
 * Resolve credentials: env vars override config file.
 */
export function getCredentials(): Credentials {
  const config = loadConfig();
  const token =
    process.env.AGENTOS_ACCESS_TOKEN ??
    process.env.AGENTOS_TOKEN ??
    config?.accessToken;
  const projectId = process.env.AGENTOS_PROJECT_ID ?? config?.projectId;
  const apiUrl =
    process.env.AGENTOS_API_URL ??
    config?.apiUrl ??
    "http://localhost:4000";
  return { token, projectId, apiUrl };
}
