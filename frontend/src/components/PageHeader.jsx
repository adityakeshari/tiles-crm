export default function PageHeader({
  isOverview,
  title,
  description,
  autoRefreshStatusText,
  audience,
  pageAction,
  onPageAction,
  workspaceLabel,
  unitLabel,
  viewLabel,
}) {
  if (isOverview) {
    return (
      <section className="page-intro panel">
        <div>
          <p className="eyebrow">Active Module</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {autoRefreshStatusText ? <p className="muted auto-refresh-note">{autoRefreshStatusText}</p> : null}
          {audience ? <span className="audience-tag">{audience}</span> : null}
        </div>
        {pageAction ? (
          <div className="page-header-actions">
            <button type="button" className="quick-action-btn secondary" onClick={onPageAction}>
              {pageAction.label}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop: full pill row — unchanged; CSS hides this on mobile (≤768px) */}
            <div className="hero-pills hero-pills-desktop">
              <span className="hero-pill hero-pill-strong">Workspace: {workspaceLabel}</span>
              <span className="hero-pill hero-pill-strong">Unit: {unitLabel}</span>
              <span className="hero-pill hero-pill-strong">View: {viewLabel}</span>
            </div>

            {/* Mobile: single compact selector-style chip replacing the 3-pill card; CSS hides on desktop */}
            <div className="workspace-compact-bar" aria-label={`Workspace ${workspaceLabel}, ${unitLabel}, ${viewLabel}`}>
              <span className="workspace-compact-label">Workspace</span>
              <span className="workspace-compact-value">{workspaceLabel}</span>
              <span className="workspace-compact-chevron" aria-hidden="true">▾</span>
              <span className="workspace-compact-meta">{unitLabel} · {viewLabel}</span>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="module-header">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        {autoRefreshStatusText ? <p className="muted auto-refresh-note">{autoRefreshStatusText}</p> : null}
      </div>
      <div className="page-header-actions">
        {audience ? <span className="audience-tag">{audience}</span> : null}
        {pageAction ? (
          <button type="button" className="quick-action-btn secondary" onClick={onPageAction}>
            {pageAction.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}
