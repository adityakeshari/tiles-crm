export default function AppHeader({
  userName,
  roleLabel,
  workspaceLabel,
  unreadCount,
  onToggleNotifications,
  onOpenDashboard,
  onLogout,
}) {
  return (
    <header className="topbar topbar-compact panel">
      <div className="hero-copy">
        <h1>
          Hello {userName || "Team"} <span className="topbar-sep">|</span>{" "}
          <span className="topbar-meta">{roleLabel}</span> <span className="topbar-sep">|</span>{" "}
          <span className="topbar-meta">{workspaceLabel}</span>
        </h1>
      </div>
      <div className="toolbar">
        <button className="secondary" onClick={onToggleNotifications}>
          Notifications {unreadCount ? `(${unreadCount})` : ""}
        </button>
        <button className="secondary" onClick={onOpenDashboard}>
          Dashboard
        </button>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

