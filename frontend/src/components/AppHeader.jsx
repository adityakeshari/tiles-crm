import { useEffect, useRef, useState } from "react";

function getInitials(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "T";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() || "").join("");
  return initials || "T";
}

export default function AppHeader({
  userName,
  roleLabel,
  workspaceLabel,
  unreadCount,
  onToggleNotifications,
  onOpenDashboard,
  onLogout,
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const initials = getInitials(userName);
  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount || 0);

  function closeMenuAnd(action) {
    setIsProfileMenuOpen(false);
    if (typeof action === "function") action();
  }

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="topbar topbar-compact panel">
      <div className="hero-copy">
        <h1>
          Hello {userName || "Team"} <span className="topbar-sep">|</span>{" "}
          <span className="topbar-meta">{roleLabel}</span> <span className="topbar-sep">|</span>{" "}
          <span className="topbar-meta">{workspaceLabel}</span>
        </h1>
      </div>

      {/* Desktop toolbar — unchanged; CSS hides this on mobile (≤768px) */}
      <div className="toolbar topbar-toolbar-desktop">
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

      {/* Compact mobile greeting bar — CSS hides this on desktop (>768px) */}
      <div className="topbar-mobile-bar">
        <p className="topbar-mobile-greeting">
          <span className="topbar-mobile-name">Hello {userName || "Team"}</span>
          <span className="topbar-mobile-sep" aria-hidden="true">·</span>
          <span className="topbar-mobile-role">{roleLabel}</span>
        </p>

        <div className="topbar-mobile-actions">
          <button
            type="button"
            className="topbar-mobile-bell"
            onClick={onToggleNotifications}
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <span aria-hidden="true">🔔</span>
            {unreadCount ? <span className="topbar-mobile-bell-badge">{badgeText}</span> : null}
          </button>

          <div className="topbar-profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="topbar-profile-avatar"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-haspopup="true"
              aria-expanded={isProfileMenuOpen}
              aria-label="Open profile menu"
            >
              {initials}
            </button>

            {isProfileMenuOpen ? (
              <>
                <div
                  className="topbar-profile-menu-backdrop"
                  onClick={() => setIsProfileMenuOpen(false)}
                  role="presentation"
                />
                <div className="topbar-profile-menu-panel" role="menu" aria-label="Profile menu">
                  <div className="topbar-profile-menu-identity">
                    <p className="topbar-profile-menu-name">{userName || "Team"}</p>
                    <p className="topbar-profile-menu-role">{roleLabel}</p>
                  </div>
                  <button type="button" role="menuitem" onClick={() => closeMenuAnd(onOpenDashboard)}>
                    Dashboard
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="topbar-profile-menu-logout"
                    onClick={() => closeMenuAnd(onLogout)}
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
