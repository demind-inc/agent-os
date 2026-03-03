"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Integration } from "../types";

type IntegrationsTabProps = {
  integrations: Integration[];
  integrationsLoading?: boolean;
  workspaceId: string;
};

export function IntegrationsTab({
  integrations,
  integrationsLoading,
  workspaceId,
}: IntegrationsTabProps) {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  async function handleConnect(provider: string) {
    if (!workspaceId) return;
    setConnectingProvider(provider);
    try {
      const { providerAuthUrl } = await apiFetch<{
        redirectUrl: string;
        providerAuthUrl?: string | null;
      }>("/integrations/oauth/start", {
        method: "POST",
        body: JSON.stringify({ provider, workspaceId }),
      });
      if (providerAuthUrl) {
        window.location.href = providerAuthUrl;
      } else {
        setConnectingProvider(null);
      }
    } catch (err) {
      console.error(err);
      setConnectingProvider(null);
    }
  }

  if (integrationsLoading) {
    return (
      <div className="settingsPage__loadingWrap">
        <div className="settingsPage__spinner" aria-label="Loading integrations" />
      </div>
    );
  }

  return (
    <div className="settingsPage__integrationGrid">
      {integrations.map((integration) => (
        <div
          key={integration.id}
          className="settingsPage__integrationCard"
        >
          <div className="settingsPage__integrationHeader">
            <div
              className="settingsPage__integrationIcon"
              style={{ backgroundColor: integration.color }}
            >
              <span
                className="settingsPage__icon settingsPage__icon--inverse"
                data-icon={integration.icon}
                aria-hidden
              />
            </div>
            <div className="settingsPage__integrationInfo">
              <span className="settingsPage__integrationName">
                {integration.name}
              </span>
              <span className="settingsPage__integrationDesc">
                {integration.description}
              </span>
            </div>
          </div>
          <div className="settingsPage__integrationFooter">
            {integration.connected ? (
              <span className="settingsPage__status settingsPage__status--active">
                <span className="settingsPage__statusDot" aria-hidden />
                Connected
              </span>
            ) : null}
            <button
              type="button"
              className={`settingsPage__btn settingsPage__btn--sm ${
                integration.connected
                  ? "settingsPage__btn--secondary"
                  : "settingsPage__btn--accent"
              }`}
              onClick={() => handleConnect(integration.provider)}
              disabled={connectingProvider != null}
            >
              {connectingProvider === integration.provider
                ? "Connecting…"
                : integration.connected
                  ? "Configure"
                  : "Connect"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
