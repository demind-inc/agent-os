"use client";

import type { NotificationPrefs } from "../types";

type NotificationsTabProps = {
  notificationPrefs: NotificationPrefs;
  loading?: boolean;
  onToggle: (key: keyof NotificationPrefs) => void;
};

export function NotificationsTab({
  notificationPrefs,
  loading,
  onToggle,
}: NotificationsTabProps) {
  if (loading) {
    return (
      <div className="settingsPage__loadingWrap">
        <div className="settingsPage__spinner" aria-label="Loading notification settings" />
      </div>
    );
  }

  return (
    <div className="settingsPage__card">
      <div className="settingsPage__cardSection">
        <h3 className="settingsPage__cardTitle">Email Notifications</h3>
        <div className="settingsPage__toggleRow">
          <div className="settingsPage__toggleInfo">
            <span className="settingsPage__toggleTitle">
              Task updates
            </span>
            <span className="settingsPage__toggleDesc">
              Get notified when tasks are assigned, completed, or need
              attention.
            </span>
          </div>
          <button
            type="button"
            className={`settingsPage__toggle ${
              notificationPrefs.taskUpdates
                ? "settingsPage__toggle--on"
                : ""
            }`}
            onClick={() => onToggle("taskUpdates")}
            aria-pressed={notificationPrefs.taskUpdates}
          >
            <span className="settingsPage__toggleKnob" />
          </button>
        </div>
        <div className="settingsPage__toggleRow">
          <div className="settingsPage__toggleInfo">
            <span className="settingsPage__toggleTitle">
              Agent activity
            </span>
            <span className="settingsPage__toggleDesc">
              Receive updates when AI agents complete tasks or need
              approval.
            </span>
          </div>
          <button
            type="button"
            className={`settingsPage__toggle ${
              notificationPrefs.agentActivity
                ? "settingsPage__toggle--on"
                : ""
            }`}
            onClick={() => onToggle("agentActivity")}
            aria-pressed={notificationPrefs.agentActivity}
          >
            <span className="settingsPage__toggleKnob" />
          </button>
        </div>
        <div className="settingsPage__toggleRow">
          <div className="settingsPage__toggleInfo">
            <span className="settingsPage__toggleTitle">
              Weekly digest
            </span>
            <span className="settingsPage__toggleDesc">
              Get a weekly summary of your workspace activity.
            </span>
          </div>
          <button
            type="button"
            className={`settingsPage__toggle ${
              notificationPrefs.weeklyDigest
                ? "settingsPage__toggle--on"
                : ""
            }`}
            onClick={() => onToggle("weeklyDigest")}
            aria-pressed={notificationPrefs.weeklyDigest}
          >
            <span className="settingsPage__toggleKnob" />
          </button>
        </div>
      </div>
      <div className="settingsPage__divider" />
      <div className="settingsPage__cardSection">
        <h3 className="settingsPage__cardTitle">Push Notifications</h3>
        <div className="settingsPage__toggleRow">
          <div className="settingsPage__toggleInfo">
            <span className="settingsPage__toggleTitle">
              Desktop notifications
            </span>
            <span className="settingsPage__toggleDesc">
              Show desktop notifications for important updates.
            </span>
          </div>
          <button
            type="button"
            className={`settingsPage__toggle ${
              notificationPrefs.desktopNotifications
                ? "settingsPage__toggle--on"
                : ""
            }`}
            onClick={() => onToggle("desktopNotifications")}
            aria-pressed={notificationPrefs.desktopNotifications}
          >
            <span className="settingsPage__toggleKnob" />
          </button>
        </div>
        <div className="settingsPage__toggleRow">
          <div className="settingsPage__toggleInfo">
            <span className="settingsPage__toggleTitle">
              Sound alerts
            </span>
            <span className="settingsPage__toggleDesc">
              Play a sound for new notifications.
            </span>
          </div>
          <button
            type="button"
            className={`settingsPage__toggle ${
              notificationPrefs.soundAlerts
                ? "settingsPage__toggle--on"
                : ""
            }`}
            onClick={() => onToggle("soundAlerts")}
            aria-pressed={notificationPrefs.soundAlerts}
          >
            <span className="settingsPage__toggleKnob" />
          </button>
        </div>
      </div>
    </div>
  );
}
