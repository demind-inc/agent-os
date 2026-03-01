"use client";

import Link from "next/link";
import "./TopBar.scss";

type TopBarProps = {
  view: "board" | "list";
  onViewChange: (view: "board" | "list") => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewTaskClick: () => void;
  userInitials: string;
};

export function TopBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onNewTaskClick,
  userInitials
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__viewToggle">
          <button
            type="button"
            className={`topbar__viewBtn ${view === "board" ? "topbar__viewBtn--active" : ""}`}
            onClick={() => onViewChange("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={`topbar__viewBtn ${view === "list" ? "topbar__viewBtn--active" : ""}`}
            onClick={() => onViewChange("list")}
          >
            List
          </button>
        </div>
        <button type="button" className="topbar__newTaskBtn" onClick={onNewTaskClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Task
        </button>
      </div>
      <div className="topbar__right">
        <input
          className="topbar__search"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Link
          href="/settings"
          className="topbar__avatar"
          title="Settings"
          aria-label="Open settings"
        >
          {userInitials}
        </Link>
      </div>
    </header>
  );
}
