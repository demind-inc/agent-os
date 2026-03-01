"use client";

import type { Workspace } from "../types";

type WorkspaceTabProps = {
  workspace: Workspace | null;
  workspaceLoading: boolean;
  workspaceSaving: boolean;
  onWorkspaceNameChange: (value: string) => void;
  onSave: () => void;
};

export function WorkspaceTab({
  workspace,
  workspaceLoading,
  workspaceSaving,
  onWorkspaceNameChange,
  onSave,
}: WorkspaceTabProps) {
  if (workspaceLoading) {
    return (
      <div className="settingsPage__loadingWrap">
        <div className="settingsPage__spinner" aria-label="Loading workspace" />
      </div>
    );
  }
  if (!workspace) {
    return (
      <p className="settingsPage__loading">
        Select a workspace to view settings.
      </p>
    );
  }

  return (
    <>
      <div className="settingsPage__card">
        <div className="settingsPage__cardSection">
          <h3 className="settingsPage__cardTitle">General</h3>
          <div className="settingsPage__fieldRow">
            <div className="settingsPage__field">
              <label
                className="settingsPage__formLabel"
                htmlFor="workspaceName"
              >
                Workspace name
              </label>
              <input
                id="workspaceName"
                type="text"
                className="settingsPage__input"
                value={workspace.name}
                onChange={(e) => onWorkspaceNameChange(e.target.value)}
              />
            </div>
            <div className="settingsPage__field">
              <label
                className="settingsPage__formLabel"
                htmlFor="workspaceUrl"
              >
                Workspace URL
              </label>
              <input
                id="workspaceUrl"
                type="text"
                className="settingsPage__input settingsPage__input--readOnly"
                value="—"
                readOnly
              />
            </div>
          </div>
        </div>
        <div className="settingsPage__divider" />
        <div className="settingsPage__cardSection">
          <h3 className="settingsPage__cardTitle">Workspace Logo</h3>
          <div className="settingsPage__logoRow">
            <div className="settingsPage__logoPreview">A</div>
            <div className="settingsPage__logoActions">
              <button
                type="button"
                className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--sm"
              >
                <span
                  className="settingsPage__icon"
                  data-icon="upload"
                  aria-hidden
                />
                Upload logo
              </button>
              <span className="settingsPage__hint">
                PNG, JPG up to 2MB
              </span>
            </div>
          </div>
        </div>
        <div className="settingsPage__divider" />
        <div className="settingsPage__cardSection">
          <h3 className="settingsPage__cardTitle settingsPage__cardTitle--danger">
            Danger Zone
          </h3>
          <div className="settingsPage__dangerBox">
            <div className="settingsPage__dangerInfo">
              <span className="settingsPage__dangerLabel">
                Delete workspace
              </span>
              <span className="settingsPage__dangerSubtext">
                Once deleted, all data will be permanently removed.
              </span>
            </div>
            <button
              type="button"
              className="settingsPage__btn settingsPage__btn--danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      <div className="settingsPage__actions settingsPage__actions--left">
        <button
          type="button"
          className="settingsPage__btn settingsPage__btn--primary"
          disabled={workspaceSaving}
          onClick={onSave}
        >
          {workspaceSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
