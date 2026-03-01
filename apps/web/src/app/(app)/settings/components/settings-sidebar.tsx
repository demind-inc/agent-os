"use client";

import Link from "next/link";
import type { NavItem, SettingsSection } from "../types";

type SettingsSidebarProps = {
  navItems: NavItem[];
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

export function SettingsSidebar({
  navItems,
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <aside className="settingsPage__sidebar">
      <div className="settingsPage__sidebarHeader">
        <Link
          href="/app"
          className="settingsPage__backBtn"
          aria-label="Back to home"
        >
          <span
            className="settingsPage__navIcon"
            data-icon="arrow-left"
            aria-hidden
          />
        </Link>
        <div className="settingsPage__logo" aria-hidden />
        <span className="settingsPage__sidebarTitle">Settings</span>
      </div>
      <nav className="settingsPage__nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settingsPage__navItem ${
              activeSection === item.id ? "settingsPage__navItem--active" : ""
            }`}
            onClick={() => onSectionChange(item.id)}
          >
            <span
              className="settingsPage__navIcon"
              data-icon={item.icon}
              aria-hidden
            />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
