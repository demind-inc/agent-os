/**
 * Detect skill installation directories for Cursor, Codex, and Claude.
 * Used so "skills add" can install into all environments the user has.
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface SkillEnv {
  name: string;
  skillsDir: string;
}

const home = homedir();

/** Cursor: .cursor/skills or ~/.cursor/skills */
function cursorDirs(): SkillEnv[] {
  const dirs: SkillEnv[] = [];
  const global = join(home, ".cursor", "skills");
  dirs.push({ name: "Cursor (global)", skillsDir: global });
  const cwd = process.cwd();
  const local = join(cwd, ".cursor", "skills");
  if (local !== global) dirs.push({ name: "Cursor (project)", skillsDir: local });
  return dirs;
}

/** Codex: $CODEX_HOME/skills or ~/.codex/skills */
function codexDirs(): SkillEnv[] {
  const base = process.env.CODEX_HOME || join(home, ".codex");
  const global = join(base, "skills");
  return [{ name: "Codex", skillsDir: global }];
}

/** Claude: ~/.claude/skills or .claude/skills */
function claudeDirs(): SkillEnv[] {
  const dirs: SkillEnv[] = [];
  const global = join(home, ".claude", "skills");
  dirs.push({ name: "Claude (global)", skillsDir: global });
  const cwd = process.cwd();
  const local = join(cwd, ".claude", "skills");
  if (local !== global) dirs.push({ name: "Claude (project)", skillsDir: local });
  return dirs;
}

/**
 * Return all known skill environments. Optionally filter to only those that
 * already have a skills directory (so we don't create many empty dirs).
 */
export function getSkillEnvs(onlyExisting: boolean = false): SkillEnv[] {
  const all: SkillEnv[] = [
    ...cursorDirs(),
    ...codexDirs(),
    ...claudeDirs(),
  ];
  if (onlyExisting) {
    return all.filter((e) => existsSync(e.skillsDir));
  }
  return all;
}

/**
 * Default targets: install to all envs. If none have an existing skills dir,
 * we still install to Cursor and Codex global by default so the first use creates them.
 */
export function getDefaultInstallTargets(): SkillEnv[] {
  const existing = getSkillEnvs(true);
  if (existing.length > 0) return existing;
  const all = getSkillEnvs(false);
  return [
    all.find((e) => e.name === "Cursor (global)")!,
    all.find((e) => e.name === "Codex")!,
    all.find((e) => e.name === "Claude (global)")!,
  ].filter(Boolean);
}
