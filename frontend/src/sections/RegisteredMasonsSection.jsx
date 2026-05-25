import { useState } from "react";

export default function RegisteredMasonsSection(props) {
  const {
    masons,
    activeMasons,
    user,
    hasAnyRole,
    masonForm,
    setMasonForm,
    masonFormErrors,
    setMasonFormErrors,
    masonStatuses,
    sanitizePositiveIntegerInput,
    masonWorkingAreaInput,
    setMasonWorkingAreaInput,
    addMasonWorkingArea,
    removeMasonWorkingArea,
    handleSaveMason,
    busyAction,
    editingMasonId,
    setEditingMasonId,
    emptyMason,
    ListLoadControls,
    listLimits,
    increaseListLimit,
    loading,
    masonCurrentCityFilter,
    setMasonCurrentCityFilter,
    masonPermanentCityFilter,
    setMasonPermanentCityFilter,
    masonWorkingAreaFilter,
    setMasonWorkingAreaFilter,
    masonWorkingDistanceFilter,
    setMasonWorkingDistanceFilter,
    filteredMasons,
    labelize,
    formatDateTime,
    startEditingMason,
    EmptyState,
    masonActivities,
    clearFieldErrorFromEvent,
    getFieldErrorClass,
  } = props;
  const [activeTab, setActiveTab] = useState("new");

  return (
    <section className="stack workspace-stack">
      <div className="module-nav workspace-tab-nav">
        <button type="button" className={activeTab === "new" ? "active-nav" : "nav-btn"} onClick={() => setActiveTab("new")}>
          New Entry
        </button>
        <button type="button" className={activeTab === "ledger" ? "active-nav" : "nav-btn"} onClick={() => setActiveTab("ledger")}>
          Ledger
        </button>
        <button type="button" className={activeTab === "reports" ? "active-nav" : "nav-btn"} onClick={() => setActiveTab("reports")}>
          Reports
        </button>
      </div>

      {activeTab === "new" ? (
        <section className="panel">
          <div className="section-head">
            <h2>Registered masons</h2>
            <span>{masons.length} registered</span>
          </div>
          {hasAnyRole(user, ["admin", "manager"]) ? (
            <form
              className="form-grid"
              onSubmit={handleSaveMason}
              onInputCapture={(event) => clearFieldErrorFromEvent(event, setMasonFormErrors)}
              onChangeCapture={(event) => clearFieldErrorFromEvent(event, setMasonFormErrors)}
            >
              <div className="form-field">
                <input data-field="name" className={getFieldErrorClass(masonFormErrors, "name")} placeholder="Mason name" value={masonForm.name} onChange={(event) => setMasonForm({ ...masonForm, name: event.target.value })} />
                {masonFormErrors?.name ? <span className="field-error-message">{masonFormErrors.name}</span> : null}
              </div>
              <div className="form-field">
                <input data-field="mobile" className={getFieldErrorClass(masonFormErrors, "mobile")} placeholder="Mobile number" value={masonForm.mobile} onChange={(event) => setMasonForm({ ...masonForm, mobile: event.target.value })} />
                {masonFormErrors?.mobile ? <span className="field-error-message">{masonFormErrors.mobile}</span> : null}
              </div>
              <input placeholder="Alternate mobile (optional)" value={masonForm.alt_mobile || ""} onChange={(event) => setMasonForm({ ...masonForm, alt_mobile: event.target.value })} />
              <div className="form-field">
                <input data-field="current_address" className={getFieldErrorClass(masonFormErrors, "current_address")} placeholder="Current address" value={masonForm.current_address} onChange={(event) => setMasonForm({ ...masonForm, current_address: event.target.value })} />
                {masonFormErrors?.current_address ? <span className="field-error-message">{masonFormErrors.current_address}</span> : null}
              </div>
              <div className="form-field">
                <input data-field="current_address_city" className={getFieldErrorClass(masonFormErrors, "current_address_city")} placeholder="Current address city" value={masonForm.current_address_city} onChange={(event) => setMasonForm({ ...masonForm, current_address_city: event.target.value })} />
                {masonFormErrors?.current_address_city ? <span className="field-error-message">{masonFormErrors.current_address_city}</span> : null}
              </div>
              <input placeholder="Permanent address" value={masonForm.permanent_address} onChange={(event) => setMasonForm({ ...masonForm, permanent_address: event.target.value })} />
              <input placeholder="Permanent address city" value={masonForm.permanent_address_city} onChange={(event) => setMasonForm({ ...masonForm, permanent_address_city: event.target.value })} />
              <div className="form-field">
                <input data-field="working_distance_upto_km" className={getFieldErrorClass(masonFormErrors, "working_distance_upto_km")} type="number" min="1" placeholder="Working distance upto (KM)" value={masonForm.working_distance_upto_km} onChange={(event) => setMasonForm({ ...masonForm, working_distance_upto_km: sanitizePositiveIntegerInput(event.target.value, "") })} />
                {masonFormErrors?.working_distance_upto_km ? <span className="field-error-message">{masonFormErrors.working_distance_upto_km}</span> : null}
              </div>
              <select value={masonForm.status} onChange={(event) => setMasonForm({ ...masonForm, status: event.target.value })}>
                {masonStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className={`full-span detail-card stack ${getFieldErrorClass(masonFormErrors, "working_areas")}`}>
                <div className="section-head">
                  <h3>Working areas</h3>
                  <button type="button" className="secondary" onClick={addMasonWorkingArea}>
                    Add Area
                  </button>
                </div>
                <div className="quote-row">
                  <input data-field="working_areas" placeholder="Working area" value={masonWorkingAreaInput} onChange={(event) => setMasonWorkingAreaInput(event.target.value)} />
                </div>
                <div className="chip-row">
                  {(masonForm.working_areas || []).map((area) => (
                    <button key={area} type="button" className="status-chip" onClick={() => removeMasonWorkingArea(area)} title="Remove working area">
                      {area} x
                    </button>
                  ))}
                  {!(masonForm.working_areas || []).length ? <span className="muted">Add at least one working area.</span> : null}
                </div>
                {masonFormErrors?.working_areas ? <span className="field-error-message">{masonFormErrors.working_areas}</span> : null}
              </div>
              <textarea className="full-span" placeholder="Remarks (optional)" value={masonForm.remarks || ""} onChange={(event) => setMasonForm({ ...masonForm, remarks: event.target.value })} />
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-mason"}>
                  {busyAction === "save-mason" ? (editingMasonId ? "Updating Mason..." : "Saving Mason...") : editingMasonId ? "Update Mason" : "Register Mason"}
                </button>
                {editingMasonId ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingMasonId(null);
                      setMasonForm(emptyMason);
                      setMasonFormErrors({});
                      setMasonWorkingAreaInput("");
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <EmptyState compact title="Registration is manager-controlled" message="Sales and operations can use only active registered masons in token redemption." />
          )}
        </section>
      ) : null}

      {activeTab === "ledger" ? (
        <section className="panel">
          <div className="section-head">
            <h2>Mason directory</h2>
            <span>{activeMasons.length} active</span>
          </div>
          <ListLoadControls count={masons.length} limit={listLimits.masons} onLoadMore={() => increaseListLimit("masons")} disabled={loading} />
          <div className="form-grid">
            <input placeholder="Filter by current city" value={masonCurrentCityFilter} onChange={(event) => setMasonCurrentCityFilter(event.target.value)} />
            <input placeholder="Filter by permanent city" value={masonPermanentCityFilter} onChange={(event) => setMasonPermanentCityFilter(event.target.value)} />
            <input placeholder="Filter by working area" value={masonWorkingAreaFilter} onChange={(event) => setMasonWorkingAreaFilter(event.target.value)} />
            <input type="number" min="1" placeholder="Minimum distance KM" value={masonWorkingDistanceFilter} onChange={(event) => setMasonWorkingDistanceFilter(event.target.value)} />
          </div>
          <div className="list">
            {filteredMasons.map((mason) => (
              <article key={mason.id} className="lead-card">
                <div className="section-head">
                  <div>
                    <h3>{mason.name}</h3>
                    <p className="muted">{mason.mobile}</p>
                  </div>
                  <span className={`status-chip ${String(mason.status || "").toLowerCase() === "active" ? "unit-chip unit-plumbing" : "status-lost"}`}>{labelize(mason.status)}</span>
                </div>
                <p>
                  {mason.current_address_city || "No current city"} | {mason.permanent_address_city || "No permanent city"}
                </p>
                <p>{(mason.working_areas || []).join(", ") || "No working areas mapped yet."}</p>
                <p className="muted">Working distance upto {mason.working_distance_upto_km || 0} KM</p>
                <p className="muted">Registered {formatDateTime(mason.registered_at)}</p>
                {hasAnyRole(user, ["admin", "manager"]) ? (
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => startEditingMason(mason)}>
                      Edit
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {filteredMasons.length === 0 ? <EmptyState title="No registered masons yet" message="Register active masons here before creating adhesive token claims." /> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="panel">
          <div className="section-head">
            <h2>Mason activity</h2>
            <span>{masonActivities.length} updates</span>
          </div>
          <div className="mini-list">
            {masonActivities.slice(0, 20).map((item) => (
              <div key={item.id} className="timeline-item">
                <strong>
                  {labelize(item.action)} | {item.mason_name || "Unknown mason"}
                </strong>
                <p className="muted">
                  {item.mason_mobile || "No mobile"} | {formatDateTime(item.created_at)}
                </p>
                <p>{item.note || "No note added."}</p>
              </div>
            ))}
            {!masonActivities.length ? <p className="muted">No mason activity yet.</p> : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
