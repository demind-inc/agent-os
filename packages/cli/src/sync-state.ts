/**
 * Persist runId for the current session so multiple chunk/done calls reuse the same run.
 * Keyed by parent process PID so each terminal/session has its own run.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface RunState {
  runId: string;
  taskId: string;
  pid?: number;
}

const STATE_DIR =
  process.env.AGENTOS_STATE_DIR || join(tmpdir(), "agentos-cli");
const STATE_FILE = join(STATE_DIR, `run-${process.ppid || process.pid}.json`);

export function getStatePath(): string {
  return STATE_FILE;
}

export function loadRunState(): RunState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as RunState;
  } catch {
    return null;
  }
}

export function saveRunState(runId: string, taskId: string): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ runId, taskId, pid: process.pid }),
    "utf8"
  );
}

export function clearRunState(): void {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}
