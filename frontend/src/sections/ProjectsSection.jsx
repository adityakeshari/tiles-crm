function ProjectCard({ project, selected, onSelect, onEdit, canEdit, labelize }) {
  return (
    <article className={`lead-card unit-${project.business_unit || "tiles"} ${selected ? "active" : ""}`} onClick={onSelect}>
      <div className="section-head">
        <div>
          <h3>{project.project_name}</h3>
          <p className="muted">
            {project.project_code} | {project.lead_name}
          </p>
        </div>
        <span className={`status-chip status-${project.status}`}>{labelize(project.status)}</span>
      </div>
      <p>{project.lead_location || "No area"}</p>
      <p className="muted">
        Net Profit Rs {project.net_profit} | Margin {project.profit_margin}%
      </p>
      <div className="lead-actions">
        <small>Pending Rs {project.pending_payment || 0}</small>
        {canEdit ? (
          <button
            type="button"
            className="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProjectDetailPanel({
  project,
  dispatchDraft,
  updateDispatchDraft,
  handleSaveDispatch,
  handleUpdateDispatchStatus,
  canManageDispatch,
  busyAction,
  BadgeCard,
  HighlightRow,
  labelize,
  formatDateTime,
  getProjectInvoicePdfUrl,
  dispatchStatuses,
}) {
  if (!project) {
    return (
      <section className="panel">
        <h2>Project detail</h2>
        <p className="muted">Select a project to review profit, dispatch, and execution details.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>{project.project_name}</h2>
          <p className="muted">
            {project.project_code} | {project.lead_name} | {project.lead_location || "No area"}
          </p>
        </div>
        <span className={`status-chip status-${project.status}`}>{labelize(project.status)}</span>
      </div>
      <div className="tabs-row">
        <BadgeCard title="Tiles Revenue" count={`Rs ${project.tiles_sales_revenue}`} />
        <BadgeCard title="Plumbing Revenue" count={`Rs ${project.plumbing_revenue}`} />
        <BadgeCard title="Net Profit" count={`Rs ${project.net_profit}`} tone="accent" />
        <BadgeCard title="Margin" count={`${project.profit_margin}%`} tone="accent" />
      </div>
      <div className="stack">
        <HighlightRow label="Adhesive Token Liability" value={`Rs ${project.labour_token_cost}`} />
        <HighlightRow label="Pending Adhesive Tokens" value={`Rs ${project.pending_token_amount}`} tone="danger" />
        <HighlightRow label="Paid Adhesive Tokens" value={`Rs ${project.paid_token_amount}`} />
        <HighlightRow label="Plumbing Material Cost" value={`Rs ${project.plumbing_material_cost}`} />
        <HighlightRow label="Received Payment" value={`Rs ${project.received_payment}`} />
        <HighlightRow label="Pending Payment" value={`Rs ${project.pending_payment}`} tone="danger" />
        <HighlightRow label="Pending Dispatch Items" value={project.pending_dispatch_items} />
      </div>
      <div className="stack">
        <h3>Adhesive token entries</h3>
        <div className="mini-list">
          {(project.adhesive_tokens || []).map((token) => (
            <div key={token.id} className="timeline-item">
              <strong>{token.mason_name}</strong>
              <p className="muted">
                {token.site_name} | {token.invoice_number} | {token.adhesive_company}
              </p>
              <p>
                {token.claimed_bag_quantity} claimed / {token.sold_bag_quantity} sold | Rs {token.total_token_amount}
              </p>
              <p className="muted">
                {labelize(token.verification_status)} | {labelize(token.status)}
              </p>
              <div className="mini-list">
                {(token.items || []).map((item) => (
                  <div key={item.id} className="timeline-item compact-line">
                    Rs {item.token_value} x {item.quantity} = Rs {item.line_total}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!project.adhesive_tokens?.length ? <p className="muted">No adhesive token entries linked to this project yet.</p> : null}
        </div>
      </div>
      <div className="stack">
        <h3>Dispatch tracking</h3>
        <div className="lead-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => window.open(getProjectInvoicePdfUrl(project.id), "_blank", "noopener,noreferrer")}
          >
            Open Invoice PDF
          </button>
        </div>
        {canManageDispatch ? (
          <div className="form-grid">
            <input placeholder="Product / material" value={dispatchDraft.item_name} onChange={(event) => updateDispatchDraft(project.id, "item_name", event.target.value)} />
            <input type="number" placeholder="Quantity" value={dispatchDraft.quantity} onChange={(event) => updateDispatchDraft(project.id, "quantity", event.target.value)} />
            <input placeholder="Vehicle number" value={dispatchDraft.vehicle_number} onChange={(event) => updateDispatchDraft(project.id, "vehicle_number", event.target.value)} />
            <input placeholder="Driver name" value={dispatchDraft.driver_name} onChange={(event) => updateDispatchDraft(project.id, "driver_name", event.target.value)} />
            <input type="datetime-local" value={dispatchDraft.dispatch_date} onChange={(event) => updateDispatchDraft(project.id, "dispatch_date", event.target.value)} />
            <select value={dispatchDraft.status} onChange={(event) => updateDispatchDraft(project.id, "status", event.target.value)}>
              {dispatchStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea className="full-span" placeholder="Dispatch note" value={dispatchDraft.note} onChange={(event) => updateDispatchDraft(project.id, "note", event.target.value)} />
            <button className="full-span" type="button" onClick={() => handleSaveDispatch(project.id)} disabled={busyAction === "save-dispatch"}>
              {busyAction === "save-dispatch" ? "Saving Dispatch..." : "Add Dispatch"}
            </button>
          </div>
        ) : null}
        <div className="mini-list">
          {(project.dispatches || []).map((dispatch) => (
            <div key={dispatch.id} className="timeline-item">
              <strong>{dispatch.item_name}</strong>
              <p>
                {dispatch.quantity} qty | {dispatch.vehicle_number || "No vehicle"} | {dispatch.driver_name || "No driver"}
              </p>
              <small>
                {labelize(dispatch.status)} | {formatDateTime(dispatch.dispatch_date)}
              </small>
              {canManageDispatch && dispatch.status !== "delivered" ? (
                <div className="lead-actions">
                  <button type="button" className="secondary" onClick={() => handleUpdateDispatchStatus(project.id, dispatch)} disabled={busyAction === "update-dispatch-status"}>
                    {dispatch.status === "pending" ? "Mark Dispatched" : "Mark Delivered"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!project.dispatches?.length ? <p className="muted">No dispatches recorded yet.</p> : null}
        </div>
      </div>
      <div className="stack">
        <h3>Owner note</h3>
        <p>{project.owner_note || "No owner note added yet."}</p>
      </div>
    </section>
  );
}

export default function ProjectsSection(props) {
  const {
    projectSummary,
    BadgeCard,
    user,
    hasAnyRole,
    projectForm,
    setProjectForm,
    handleSaveProject,
    editingProjectId,
    setEditingProjectId,
    emptyProject,
    projectStatuses,
    convertedLeadOptions,
    ListLoadControls,
    projects,
    listLimits,
    increaseListLimit,
    loading,
    filteredProjects,
    selectedProject,
    setSelectedProject,
    startEditingProject,
    EmptyState,
    dispatchDrafts,
    emptyDispatch,
    updateDispatchDraft,
    handleSaveDispatch,
    requestDispatchStatusUpdate,
    busyAction,
    labelize,
    HighlightRow,
    formatDateTime,
    getProjectInvoicePdfUrl,
    dispatchStatuses,
  } = props;

  return (
    <section className="content-grid">
      <section className="panel">
        <div className="section-head">
          <h2>Project control</h2>
          <span>{projectSummary?.total_projects ?? 0} projects</span>
        </div>
        <div className="tabs-row">
          <BadgeCard title="Active" count={projectSummary?.active_projects ?? 0} tone="accent" />
          <BadgeCard title="Completed" count={projectSummary?.completed_projects ?? 0} />
          <BadgeCard title="Pending Dispatch" count={projectSummary?.pending_dispatch_items ?? 0} tone="danger" />
          <BadgeCard title="Pending Plumbing" count={projectSummary?.pending_plumbing_jobs ?? 0} />
        </div>
        {hasAnyRole(user, ["admin", "manager", "operations"]) ? (
          <form className="form-grid" onSubmit={handleSaveProject}>
            <select value={projectForm.lead_id} onChange={(event) => setProjectForm({ ...projectForm, lead_id: event.target.value })}>
              <option value="">Select converted lead</option>
              {convertedLeadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} | {lead.phone}
                </option>
              ))}
            </select>
            <input placeholder="Project name" value={projectForm.project_name} onChange={(event) => setProjectForm({ ...projectForm, project_name: event.target.value })} />
            <select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>
              {projectStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input type="date" value={projectForm.start_date} onChange={(event) => setProjectForm({ ...projectForm, start_date: event.target.value })} />
            <input type="date" value={projectForm.expected_delivery_date} onChange={(event) => setProjectForm({ ...projectForm, expected_delivery_date: event.target.value })} />
            <input type="date" value={projectForm.completion_date} onChange={(event) => setProjectForm({ ...projectForm, completion_date: event.target.value })} />
            <textarea className="full-span" placeholder="Owner note" value={projectForm.owner_note} onChange={(event) => setProjectForm({ ...projectForm, owner_note: event.target.value })} />
            <div className="lead-actions full-span">
              <button type="submit" disabled={busyAction === "save-project"}>
                {busyAction === "save-project" ? (editingProjectId ? "Updating Project..." : "Creating Project...") : editingProjectId ? "Update Project" : "Create Project"}
              </button>
              {editingProjectId ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditingProjectId(null);
                    setProjectForm(emptyProject);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
        <ListLoadControls count={projects.length} limit={listLimits.projects} onLoadMore={() => increaseListLimit("projects")} disabled={loading} />
        <div className="list">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={selectedProject?.id === project.id}
              onSelect={() => setSelectedProject(project)}
              onEdit={() => startEditingProject(project)}
              canEdit={hasAnyRole(user, ["admin", "manager", "operations"])}
              labelize={labelize}
            />
          ))}
          {filteredProjects.length === 0 ? <EmptyState title="No projects yet" message="Converted leads will show up here once a project is created." /> : null}
        </div>
      </section>

      <ProjectDetailPanel
        project={selectedProject}
        dispatchDraft={dispatchDrafts[selectedProject?.id] || emptyDispatch}
        updateDispatchDraft={updateDispatchDraft}
        handleSaveDispatch={handleSaveDispatch}
        handleUpdateDispatchStatus={requestDispatchStatusUpdate}
        canManageDispatch={hasAnyRole(user, ["admin", "manager", "operations"])}
        busyAction={busyAction}
        BadgeCard={BadgeCard}
        HighlightRow={HighlightRow}
        labelize={labelize}
        formatDateTime={formatDateTime}
        getProjectInvoicePdfUrl={getProjectInvoicePdfUrl}
        dispatchStatuses={dispatchStatuses}
      />
    </section>
  );
}
