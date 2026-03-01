"use client";

import "./TopBar.scss";

type TopBarProps = {
  view: "board" | "list";
  onViewChange: (view: "board" | "list") => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewTaskClick: () => void;
  userInitials?: string;
};

export function TopBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onNewTaskClick,
  userInitials = "JD"
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <strong>[untitled]</strong>
        <button
          type="button"
          className={`topbar__btn ${view === "board" ? "topbar__btnPrimary" : ""}`}
          onClick={() => onViewChange("board")}
        >
          Board View
        </button>
        <button
          type="button"
          className={`topbar__btn ${view === "list" ? "topbar__btnPrimary" : ""}`}
          onClick={() => onViewChange("list")}
        >
          List View
        </button>
        <button type="button" className="topbar__btn topbar__btnPrimary" onClick={onNewTaskClick}>
          + New Task
        </button>
      </div>
      <div className="topbar__right">
        <input
          className="topbar__search"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="topbar__avatar">{userInitials}</div>
      </div>
    </header>
  );
}
