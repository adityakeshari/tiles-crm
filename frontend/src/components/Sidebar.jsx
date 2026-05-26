export default function Sidebar({
  navGroups,
  visibleViews,
  isAdminUser,
  currentView,
  onSelectView,
  isMobileSidebar,
  isSidebarMobileOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  onCloseMobile,
  compactSidebarIcons,
}) {
  return (
    <>
      {isMobileSidebar && isSidebarMobileOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`sidebar panel ${isSidebarCollapsed && !isMobileSidebar ? "sidebar-collapsed" : ""} ${isMobileSidebar ? "sidebar-drawer" : ""} ${isSidebarMobileOpen ? "sidebar-drawer-open" : ""}`}
      >
        <div className="sidebar-header">
          {isMobileSidebar ? (
            <button
              type="button"
              className="secondary sidebar-toggle sidebar-mobile-launch"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            className="secondary sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed && !isMobileSidebar ? "Expand sidebar" : "Collapse sidebar"}
          >
            Menu
          </button>
        </div>
        <div className="sidebar-brand">
          <p className="eyebrow">AIBA Tiles</p>
          <strong>Showroom CRM</strong>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navGroups.map((group) => {
            const allowed = group.items.filter(
              (item) =>
                visibleViews.some((view) => view.id === item.id) &&
                (item.id !== "team" || isAdminUser)
            );
            if (!allowed.length) return null;
            return (
              <div className="sidebar-group" key={group.id}>
                <p className="sidebar-group-label">{group.label}</p>
                <div className="sidebar-items">
                  {allowed.map((item) => (
                    <button
                      key={`${group.id}-${item.id}`}
                      type="button"
                      title={item.label}
                      className={currentView === item.id ? "sidebar-item sidebar-item-active" : "sidebar-item"}
                      onClick={() => onSelectView(item.id)}
                    >
                      <span className="sidebar-dot" aria-hidden="true" />
                      <span className="sidebar-item-text">{item.label}</span>
                      <span className="sidebar-item-compact" aria-hidden="true">
                        {compactSidebarIcons[item.id] || "--"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

