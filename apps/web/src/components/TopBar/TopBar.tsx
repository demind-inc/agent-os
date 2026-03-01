"use client";

import "./TopBar.scss";

type TopBarProps = {
  view: "board" | "list";
  onViewChange: (view: "board" | "list") => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewTaskClick: () => void;
  onLogout: () => void;
  userInitials?: string;
};

export function TopBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onNewTaskClick,
  onLogout,
  userInitials = "JD"
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
        <button type="button" className="topbar__notifBtn" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        </button>
        <button type="button" className="topbar__logoutBtn" onClick={onLogout}>
          Log out
        </button>
        <div className="topbar__avatar" title={userInitials}>
          {userInitials}
        </div>
      </div>
    </header>
  );
}
