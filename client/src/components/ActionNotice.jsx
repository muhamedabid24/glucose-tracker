import React from "react";
// Persistent, dismissible feedback avoids time limits and never steals focus.
export function ActionNotice({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div
      className={`notice notice-toast ${notice.error ? "error" : "success"}`}
      role={notice.error ? "alert" : "status"}
      aria-live={notice.error ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span>{notice.text}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        Close
      </button>
    </div>
  );
}
