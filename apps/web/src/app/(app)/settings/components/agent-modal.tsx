"use client";

import { useState } from "react";
import {
  AGENT_BACKENDS,
  AGENT_MODELS,
  AVAILABLE_SKILLS,
} from "@/lib/agents/constants";
import type { Agent, AgentBackend } from "@/types/domain";

export type AgentFormState = {
  name: string;
  slug: string;
  backend: AgentBackend;
  model: string;
  skills: string[];
};

type WorkspaceSkill = { id: string; name: string };

type AgentModalProps = {
  open: boolean;
  editingAgent: Agent | null;
  form: AgentFormState;
  saving: boolean;
  workspaceSkills: WorkspaceSkill[];
  onFormChange: (updater: (prev: AgentFormState) => AgentFormState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onToggleSkill: (skill: string) => void;
  onImportSkillFromUrl: (url: string, name?: string) => Promise<void>;
};

export function AgentModal({
  open,
  editingAgent,
  form,
  saving,
  workspaceSkills,
  onFormChange,
  onClose,
  onSubmit,
  onToggleSkill,
  onImportSkillFromUrl,
}: AgentModalProps) {
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFromUrl(e: React.FormEvent) {
    e.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    setImportError(null);
    setImporting(true);
    try {
      await onImportSkillFromUrl(url, importName.trim() || undefined);
      setImportUrl("");
      setImportName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        const o = JSON.parse(msg);
        setImportError(typeof o?.error === "string" ? o.error : msg);
      } catch {
        setImportError(msg || "Import failed");
      }
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="settingsPage__modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agentModalTitle"
    >
      <div className="settingsPage__modal">
        <h2 id="agentModalTitle" className="settingsPage__modalTitle">
          {editingAgent ? "Edit Agent" : "Add Agent"}
        </h2>
        <form
          className="settingsPage__modalForm"
          onSubmit={onSubmit}
        >
          <div className="settingsPage__formField">
            <label className="settingsPage__formLabel" htmlFor="agentName">
              Name
            </label>
            <input
              id="agentName"
              type="text"
              className="settingsPage__formInput"
              value={form.name}
              onChange={(e) =>
                onFormChange((p) => ({ ...p, name: e.target.value }))
              }
              required
              placeholder="e.g. Research Agent"
            />
          </div>
          <div className="settingsPage__formField">
            <label className="settingsPage__formLabel" htmlFor="agentSlug">
              Slug
            </label>
            <input
              id="agentSlug"
              type="text"
              className="settingsPage__formInput"
              value={form.slug}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                }))
              }
              required
              placeholder="e.g. research"
            />
          </div>
          <div className="settingsPage__formField">
            <label className="settingsPage__formLabel">
              Model (backend)
            </label>
            <div className="settingsPage__fieldRow">
              <select
                className="settingsPage__formInput"
                value={form.backend}
                onChange={(e) => {
                  const backend = e.target.value as AgentBackend;
                  onFormChange((p) => ({
                    ...p,
                    backend,
                    model: AGENT_MODELS[backend][0].value,
                  }));
                }}
              >
                {AGENT_BACKENDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <select
                className="settingsPage__formInput"
                value={form.model}
                onChange={(e) =>
                  onFormChange((p) => ({ ...p, model: e.target.value }))
                }
              >
                {AGENT_MODELS[form.backend].map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="settingsPage__formField">
            <label className="settingsPage__formLabel">Preset skills</label>
            <div className="settingsPage__skillsChips">
              {AVAILABLE_SKILLS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={`settingsPage__skillChip ${
                    form.skills.includes(skill)
                      ? "settingsPage__skillChip--active"
                      : ""
                  }`}
                  onClick={() => onToggleSkill(skill)}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          {workspaceSkills.length > 0 && (
            <div className="settingsPage__formField">
              <label className="settingsPage__formLabel">Imported / workspace skills</label>
              <div className="settingsPage__skillsChips">
                {workspaceSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={`settingsPage__skillChip ${
                      form.skills.includes(skill.name)
                        ? "settingsPage__skillChip--active"
                        : ""
                    }`}
                    onClick={() => onToggleSkill(skill.name)}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="settingsPage__formField">
            <label className="settingsPage__formLabel">Import skill from URL</label>
            <form
              className="settingsPage__importSkillForm"
              onSubmit={handleImportFromUrl}
            >
              <input
                type="url"
                className="settingsPage__formInput"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/.../SKILL.md"
                disabled={importing}
              />
              <input
                type="text"
                className="settingsPage__formInput"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Skill name (optional)"
                disabled={importing}
              />
              <button
                type="submit"
                className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--sm"
                disabled={importing || !importUrl.trim()}
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </form>
            {importError && (
              <span className="settingsPage__importError">{importError}</span>
            )}
          </div>
          <div className="settingsPage__modalActions">
            <button
              type="button"
              className="settingsPage__btn settingsPage__btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="settingsPage__btn settingsPage__btn--primary"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingAgent
                ? "Save changes"
                : "Add Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
