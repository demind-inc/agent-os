"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

export type ProviderApiKeysState = {
  anthropic?: { configured: boolean };
  openai?: { configured: boolean };
};

type ApiKeysTabProps = {
  loading?: boolean;
  onLoad?: () => void;
};

export function ApiKeysTab({ loading: externalLoading, onLoad }: ApiKeysTabProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<ProviderApiKeysState>({});
  const [tokenCopied, setTokenCopied] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [savingProvider, setSavingProvider] = useState<"anthropic" | "openai" | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

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
        <h3 className="settingsPage__cardTitle">External Sync (Codex, Cursor, Claude, OpenClaw)</h3>
        <p className="settingsPage__fieldHint">
          Use this token to sync execution logs from external agents. When the agent prompts, paste the token in chat.
          See the agentos-sync skill README for setup.
        </p>
        <button
          type="button"
          className="settingsPage__btn settingsPage__btn--secondary"
          onClick={async () => {
            const supabase = createClient();
            const { data: { session }, error } = await supabase.auth.refreshSession();
            const token = session?.access_token;
            if (error || !token) {
              setMessage({ type: "err", text: "Session expired. Please log in again." });
              setTimeout(() => setMessage(null), 4000);
              return;
            }
            if (typeof window !== "undefined") {
              localStorage.setItem("agentos_access_token", token);
            }
            await navigator.clipboard.writeText(token);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
          }}
        >
          {tokenCopied ? "Copied!" : "Copy access token"}
        </button>
      </div>
    </div>
  );
}
