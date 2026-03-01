"use client";

import type { Integration } from "../types";

type IntegrationsTabProps = {
  integrations: Integration[];
  integrationsLoading?: boolean;
};

export function IntegrationsTab({
  integrations,
  integrationsLoading,
}: IntegrationsTabProps) {
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
            >
              {integration.connected ? "Configure" : "Connect"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
