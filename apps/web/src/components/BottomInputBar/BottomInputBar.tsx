"use client";

import "./BottomInputBar.scss";

export function BottomInputBar() {
  return (
    <div className="bottomInputBar">
      <div className="bottomInputBar__input">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          style={{ flexShrink: 0 }}
        >
          <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1 4v4H7v2h4v4h2v-4h4v-2h-4V8h-2z" />
        </svg>
        <span>Type to assign AI or record a decision...</span>
      </div>
      <button type="button" className="bottomInputBar__addBtn" aria-label="Add">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </div>
  );
}
