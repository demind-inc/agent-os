"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";

export type ProviderApiKeysState = {
  anthropic?: { configured: boolean };
  openai?: { configured: boolean };
};

type Project = { id: string; name: string };
type AgentosApiKey = {
  id: string;
  key_prefix: string;
  project_id: string;
  project_name: string | null;
  name: string | null;
  created_at: string;
};

type ApiKeysTabProps = {
  loading?: boolean;
  onLoad?: () => void;
};

export function ApiKeysTab({ loading: externalLoading, onLoad }: ApiKeysTabProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<ProviderApiKeysState>({});
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [savingProvider, setSavingProvider] = useState<"anthropic" | "openai" | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [agentosKeys, setAgentosKeys] = useState<AgentosApiKey[]>([]);
  const [agentosKeysLoading, setAgentosKeysLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [createProjectId, setCreateProjectId] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyShown, setNewKeyShown] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ key: string; value: ProviderApiKeysState | null }>(
        "/user/settings?key=provider_api_keys"
      );
      setConfigured((data?.value as ProviderApiKeysState) ?? {});
    } catch (e) {
      console.error(e);
      setConfigured({});
    } finally {
      setLoading(false);
      onLoad?.();
    }
  }, [onLoad]);

  const loadAgentosKeys = useCallback(async () => {
    setAgentosKeysLoading(true);
    try {
      const data = await apiFetch<{ apiKeys: AgentosApiKey[] }>("/user/api-keys");
      setAgentosKeys(data.apiKeys ?? []);
    } catch (e) {
      console.error(e);
      setAgentosKeys([]);
    } finally {
      setAgentosKeysLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    const workspaceId =
      typeof window !== "undefined" ? localStorage.getItem("agentos_workspace_id") : null;
    if (!workspaceId) return;
    try {
      const data = await apiFetch<{ projects?: Project[] }>(
        `/workspaces/${workspaceId}/projects`
      );
      const list = Array.isArray(data) ? data : (data as { projects?: Project[] }).projects ?? [];
      setProjects(list);
      if (list.length > 0) setCreateProjectId((prev) => prev || list[0].id);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAgentosKeys();
    loadProjects();
  }, [loadAgentosKeys, loadProjects]);

  async function saveProvider(provider: "anthropic" | "openai") {
    const key = provider === "anthropic" ? anthropicKey.trim() : openaiKey.trim();
    if (!key) {
      setMessage({ type: "err", text: "Enter an API key." });
      return;
    }
    setSavingProvider(provider);
    setMessage(null);
    try {
      await apiFetch("/user/settings", {
        method: "PATCH",
        body: JSON.stringify({
          key: "provider_api_keys",
          value: provider === "anthropic" ? { anthropic: key } : { openai: key },
        }),
      });
      setConfigured((prev) => ({
        ...prev,
        [provider]: { configured: true },
      }));
      if (provider === "anthropic") setAnthropicKey("");
      else setOpenaiKey("");
      setMessage({ type: "ok", text: `${provider === "anthropic" ? "Anthropic" : "OpenAI"} key saved.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: "err", text: "Failed to save key. Please try again." });
    } finally {
      setSavingProvider(null);
    }
  }

  const isLoading = externalLoading ?? loading;

  if (isLoading) {
    return (
      <div className="settingsPage__loadingWrap">
        <div className="settingsPage__spinner" aria-label="Loading API keys" />
      </div>
    );
  }

  return (
    <div className="settingsPage__card">
      <p className="settingsPage__cardDesc">
        When you run a task, the AI uses your connected API key for that model. Keys are stored securely and never
        shared.
      </p>
      {message && (
        <div
          className={`settingsPage__message ${
            message.type === "ok" ? "settingsPage__message--success" : "settingsPage__message--error"
          }`}
          role="status"
        >
          {message.text}
        </div>
      )}
      <div className="settingsPage__cardSection">
        <h3 className="settingsPage__cardTitle">Anthropic (Claude)</h3>
        <p className="settingsPage__fieldHint">
          Used for agents with backend &quot;Claude&quot;. Get a key at{" "}
          <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <div className="settingsPage__apiKeyRow">
          <input
            type="password"
            className="settingsPage__input"
            placeholder={configured.anthropic?.configured ? "••••••••••••••••" : "sk-ant-..."}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            aria-label="Anthropic API key"
            autoComplete="off"
          />
          <button
            type="button"
            className="settingsPage__btn settingsPage__btn--primary"
            onClick={() => saveProvider("anthropic")}
            disabled={savingProvider === "anthropic" || !anthropicKey.trim()}
          >
            {savingProvider === "anthropic" ? "Saving…" : configured.anthropic?.configured ? "Update key" : "Save key"}
          </button>
        </div>
        {configured.anthropic?.configured && (
          <p className="settingsPage__fieldStatus settingsPage__fieldStatus--ok">Anthropic key connected</p>
        )}
      </div>
      <div className="settingsPage__divider" />
      <div className="settingsPage__cardSection">
        <h3 className="settingsPage__cardTitle">OpenAI (Codex / GPT)</h3>
        <p className="settingsPage__fieldHint">
          Used for agents with backend &quot;Codex&quot;. Get a key at{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
            platform.openai.com
          </a>
          .
        </p>
        <div className="settingsPage__apiKeyRow">
          <input
            type="password"
            className="settingsPage__input"
            placeholder={configured.openai?.configured ? "••••••••••••••••" : "sk-..."}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            aria-label="OpenAI API key"
            autoComplete="off"
          />
          <button
            type="button"
            className="settingsPage__btn settingsPage__btn--primary"
            onClick={() => saveProvider("openai")}
            disabled={savingProvider === "openai" || !openaiKey.trim()}
          >
            {savingProvider === "openai" ? "Saving…" : configured.openai?.configured ? "Update key" : "Save key"}
          </button>
        </div>
        {configured.openai?.configured && (
          <p className="settingsPage__fieldStatus settingsPage__fieldStatus--ok">OpenAI key connected</p>
        )}
      </div>
      <div className="settingsPage__divider" />
      <div className="settingsPage__cardSection">
        <h3 className="settingsPage__cardTitle">AgentOS API key (CLI &amp; skills)</h3>
        <p className="settingsPage__fieldHint">
          Create an API key so the AgentOS CLI and skills (Codex, Cursor, Claude, OpenClaw) can create tasks and stream
          to the execution console without logging in. Each key is scoped to one project.
        </p>
        {newKeyShown && (
          <div className="settingsPage__message settingsPage__message--success" style={{ marginBottom: "0.75rem" }}>
            <strong>Copy your API key now — it won&apos;t be shown again.</strong>
            <div className="settingsPage__apiKeyRow" style={{ marginTop: "0.5rem" }}>
              <code style={{ flex: 1, wordBreak: "break-all" }}>{newKeyShown}</code>
              <button
                type="button"
                className="settingsPage__btn settingsPage__btn--primary"
                onClick={async () => {
                  await navigator.clipboard.writeText(newKeyShown);
                  setMessage({ type: "ok", text: "Copied to clipboard." });
                  setTimeout(() => setMessage(null), 2000);
                }}
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              className="settingsPage__btn settingsPage__btn--secondary"
              style={{ marginTop: "0.5rem" }}
              onClick={() => setNewKeyShown(null)}
            >
              Done
            </button>
          </div>
        )}
        {!newKeyShown && (
          <>
            <div className="settingsPage__apiKeyRow" style={{ marginBottom: "0.5rem" }}>
              <select
                className="settingsPage__input"
                value={createProjectId}
                onChange={(e) => setCreateProjectId(e.target.value)}
                aria-label="Project for new API key"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="settingsPage__input"
                placeholder="Key name (optional)"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                aria-label="API key name"
              />
              <button
                type="button"
                className="settingsPage__btn settingsPage__btn--primary"
                disabled={creating || !createProjectId}
                onClick={async () => {
                  setCreating(true);
                  setMessage(null);
                  try {
                    const res = await apiFetch<{ apiKey: string }>("/user/api-keys", {
                      method: "POST",
                      body: JSON.stringify({
                        projectId: createProjectId,
                        name: createName.trim() || undefined,
                      }),
                    });
                    setNewKeyShown(res.apiKey);
                    setCreateName("");
                    await loadAgentosKeys();
                  } catch (err) {
                    setMessage({
                      type: "err",
                      text: err instanceof Error ? err.message : "Failed to create API key.",
                    });
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "Creating…" : "Create API key"}
              </button>
            </div>
            {agentosKeysLoading ? (
              <p className="settingsPage__fieldHint">Loading keys…</p>
            ) : agentosKeys.length > 0 ? (
              <ul className="settingsPage__list" style={{ marginTop: "0.5rem" }}>
                {agentosKeys.map((k) => (
                  <li key={k.id} className="settingsPage__apiKeyRow">
                    <span className="settingsPage__fieldHint">
                      <code>{k.key_prefix}…</code>
                      {k.project_name != null && ` · ${k.project_name}`}
                      {k.name != null && ` · ${k.name}`}
                    </span>
                    <button
                      type="button"
                      className="settingsPage__btn settingsPage__btn--secondary"
                      disabled={revokingId === k.id}
                      onClick={async () => {
                        if (!confirm("Revoke this API key? It will stop working immediately.")) return;
                        setRevokingId(k.id);
                        try {
                          await apiFetch(`/user/api-keys/${k.id}`, { method: "DELETE" });
                          await loadAgentosKeys();
                        } finally {
                          setRevokingId(null);
                        }
                      }}
                    >
                      {revokingId === k.id ? "Revoking…" : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
