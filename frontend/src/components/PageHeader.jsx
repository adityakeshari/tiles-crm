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
          <div className="hero-pills">
            <span className="hero-pill hero-pill-strong">Workspace: {workspaceLabel}</span>
            <span className="hero-pill hero-pill-strong">Unit: {unitLabel}</span>
            <span className="hero-pill hero-pill-strong">View: {viewLabel}</span>
          </div>
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
