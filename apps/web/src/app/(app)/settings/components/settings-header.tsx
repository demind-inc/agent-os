"use client";

type SettingsHeaderProps = {
  title: string;
  subtitle: string;
  action?: { label: string; icon: string } | null;
  onActionClick?: () => void;
};

export function SettingsHeader({
  title,
  subtitle,
  action,
  onActionClick,
}: SettingsHeaderProps) {
  return (
    <header
      className={`settingsPage__header ${
        action ? "settingsPage__header--split" : ""
      }`}
    >
      <div className="settingsPage__headerText">
        <h1 className="settingsPage__title">{title}</h1>
        <p className="settingsPage__subtitle">{subtitle}</p>
      </div>
      {action && (
        <button
          type="button"
          className="settingsPage__actionBtn"
          onClick={onActionClick}
        >
          <span
            className="settingsPage__icon"
            data-icon={action.icon}
            aria-hidden
          />
          {action.label}
        </button>
      )}
    </header>
  );
}
