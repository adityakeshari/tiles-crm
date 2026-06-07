import { useEffect, useState } from "react";

function isQuotationExpired(createdAt) {
  if (!createdAt) {
    return false;
  }

  const createdDate = new Date(createdAt);
  const today = new Date();
  return createdDate.toDateString() !== today.toDateString();
}

function AccordionSection({ title, badge, summary, isOpen, onToggle, children }) {
  return (
    <div className={`accordion-section ${isOpen ? "open" : ""}`}>
      <button type="button" className="accordion-trigger" onClick={onToggle}>
        <div>
          <strong>{title}</strong>
          <p className="muted">{summary}</p>
        </div>
        <span className="status-chip">{badge}</span>
      </button>
      {isOpen ? <div className="accordion-body">{children}</div> : null}
    </div>
  );
}

function LeadCard({ lead, selected, onSelect, onDelete, canDelete = false, formatDateTime }) {
  return (
    <article className={`lead-card unit-${lead.business_unit} ${selected ? "active" : ""}`} onClick={onSelect}>
      <div className="lead-card-main">
        <h3>{lead.name}</h3>
        <p className="muted lead-card-line">{lead.phone} | {lead.location || "No area"}</p>
        <p className="muted lead-card-line">
          Budget Rs {lead.budget || 0} | Next follow-up: {lead.latest_followup ? formatDateTime(lead.latest_followup) : "Not scheduled"}
        </p>
        {/* Mobile Fix Batch 2 — Leads card-view: the Leads list already renders
            as cards (not a table) on every screen size, so there's no table to
            convert. These two lines simply surface the requirement/product
            interest and assigned-person fields — present in `lead` already —
            so a phone user gets the same essentials a table row would carry.
            They're rendered unconditionally here but kept hidden above the
            768px breakpoint via `.lead-card-mobile-meta` in styles.css, so the
            desktop/tablet card is pixel-identical to before. Other modules can
            copy this same "always render in JSX, reveal via CSS at <=768px"
            pattern instead of building a separate mobile-only render path. */}
        <p className="muted lead-card-line lead-card-mobile-meta">
          Interested in: {lead.requirement || "Not noted yet"}
        </p>
        <p className="muted lead-card-line lead-card-mobile-meta">
          Assigned to: {lead.assigned_to_name || "Unassigned"}
        </p>
      </div>
      <div className="lead-card-footer">
        <span className={`status-chip status-${lead.status}`}>{lead.status_label || lead.status}</span>
        {canDelete ? (
          <button
            type="button"
            className="danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}

function LeadDetailsPanel(props) {
  const {
    className = "",
    selectedLead,
    userRoles,
    editingLead,
    setEditingLead,
    users,
    followupForm,
    setFollowupForm,
    followupFormErrors = {},
    setFollowupFormErrors = () => {},
    paymentForm,
    setPaymentForm,
    quotationForm,
    setQuotationForm,
    quotationFormErrors = {},
    setQuotationFormErrors = () => {},
    followups,
    payments,
    operationsTasks,
    quotations,
    plumbingJobs,
    plumbers,
    plumbingJobForm,
    setPlumbingJobForm,
    plumbingMaterialDrafts,
    updatePlumbingMaterialDraft,
    products,
    handleUpdateLead,
    handleCreateFollowup,
    handleCreatePayment,
    handleCreateOperationsTask,
    handleCreateQuotation,
    handleCreatePlumbingJob,
    handleUpdatePlumbingJobStatus,
    handleAddPlumbingMaterial,
    operationsTaskForm,
    setOperationsTaskForm,
    updateQuotationItem,
    addQuotationItem,
    addInventoryProductToQuote,
    busyAction,
    followupTypes,
    paymentTypes,
    availableUserRoles,
    plumbingWorkTypes,
    plumbingJobStatuses,
    labelize,
    formatDateTime,
    shareOnWhatsApp,
    buildFollowupWhatsAppMessage,
    buildVisitReminderMessage,
    buildQuotationWhatsAppMessage,
    getQuotationPdfUrl,
    clearFieldErrorFromEvent = () => {},
    getFieldErrorClass = () => "",
  } = props;

  const [openSection, setOpenSection] = useState("followups");
  const effectiveRoles = Array.isArray(userRoles) ? userRoles : [];
  const canManagePayments = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("accounts");
  const canManageOperations = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("operations");
  const canManagePlumbing = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("operations");
  const canManageQuotations = effectiveRoles.includes("admin") || effectiveRoles.includes("manager") || effectiveRoles.includes("sales");

  useEffect(() => {
    setOpenSection("followups");
  }, [selectedLead?.id]);

  if (!selectedLead) {
    return (
      <section className={`panel lead-details-panel ${className}`.trim()}>
        <h2>Lead details</h2>
        <p className="muted">Select a lead to view follow-ups, quotation, payment and actions.</p>
      </section>
    );
  }

  return (
    <section className={`panel lead-details-panel ${className}`.trim()}>
      <div className="section-head">
        <h2>{selectedLead.name}</h2>
        <span className={`status-chip status-${selectedLead.status}`}>{labelize(selectedLead.status)}</span>
      </div>
      <div className="detail-card stack">
        <p className="muted">
          {selectedLead.phone} | {selectedLead.location || "No location"} | {labelize(selectedLead.customer_type)}
        </p>
        <div className="chip-row">
          <span className={`status-chip unit-chip unit-${selectedLead.business_unit}`}>{labelize(selectedLead.business_unit)}</span>
          <span className="status-chip">{labelize(selectedLead.department)}</span>
          <span className="status-chip">{labelize(selectedLead.requirement_category)}</span>
        </div>
        <p>
          Budget Rs {selectedLead.budget || 0} | Timeline {labelize(selectedLead.timeline)}
        </p>
        <p>
          Plumbing jobs {selectedLead.plumbing_jobs_count || 0} | Plumbing value Rs {selectedLead.total_plumbing_cost || 0}
        </p>
        <p className="muted">
          Source {labelize(selectedLead.lead_source)} | Assigned to {selectedLead.assigned_to_name || "Unassigned"}
        </p>
        <p>{selectedLead.requirement || "Requirement details not added yet."}</p>
        <div className="lead-actions">
          <button type="button" className="secondary" onClick={() => shareOnWhatsApp(selectedLead.phone, buildFollowupWhatsAppMessage(selectedLead))}>
            WhatsApp Follow-up
          </button>
          <button type="button" onClick={() => shareOnWhatsApp(selectedLead.phone, buildVisitReminderMessage(selectedLead))}>
            Visit Reminder
          </button>
        </div>
      </div>

      <div className="accordion-stack">
        <AccordionSection title="Follow-ups" badge={`${followups.length} entries`} isOpen={openSection === "followups"} onToggle={() => setOpenSection(openSection === "followups" ? "" : "followups")} summary="Track calls, WhatsApp reminders, and visit commitments in one place.">
          <form
            className="stack"
            onSubmit={handleCreateFollowup}
            onInputCapture={(event) => clearFieldErrorFromEvent(event, setFollowupFormErrors)}
            onChangeCapture={(event) => clearFieldErrorFromEvent(event, setFollowupFormErrors)}
          >
            <select value={followupForm.followup_type} onChange={(event) => setFollowupForm({ ...followupForm, followup_type: event.target.value })}>
              {followupTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="form-field">
              <textarea data-field="note" className={getFieldErrorClass(followupFormErrors, "note")} placeholder="Conversation note" value={followupForm.note} onChange={(event) => setFollowupForm({ ...followupForm, note: event.target.value })} />
              {followupFormErrors?.note ? <span className="field-error-message">{followupFormErrors.note}</span> : null}
            </div>
            <div className="form-field">
              <input data-field="followup_date" className={getFieldErrorClass(followupFormErrors, "followup_date")} type="datetime-local" value={followupForm.followup_date} onChange={(event) => setFollowupForm({ ...followupForm, followup_date: event.target.value })} />
              {followupFormErrors?.followup_date ? <span className="field-error-message">{followupFormErrors.followup_date}</span> : null}
            </div>
            <button type="submit" disabled={busyAction === "save-followup"}>
              {busyAction === "save-followup" ? "Saving Follow-up..." : "Save Follow-up"}
            </button>
            <div className="mini-list">
              {followups.map((item) => (
                <div key={item.id} className="timeline-item">
                  <strong>{labelize(item.followup_type)}</strong>
                  <p>{item.note}</p>
                  <small>{formatDateTime(item.followup_date)}</small>
                </div>
              ))}
              {followups.length === 0 ? <p className="muted">No follow-ups logged yet.</p> : null}
            </div>
          </form>
        </AccordionSection>

        {canManagePayments ? (
          <AccordionSection title="Payment tracking" badge={`${payments.length} payments`} isOpen={openSection === "payments"} onToggle={() => setOpenSection(openSection === "payments" ? "" : "payments")} summary="Capture advances, balances, and due reminders without leaving the lead.">
            <form className="stack" onSubmit={handleCreatePayment}>
              <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
              <select value={paymentForm.payment_type} onChange={(event) => setPaymentForm({ ...paymentForm, payment_type: event.target.value })}>
                {paymentTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input type="datetime-local" value={paymentForm.due_date} onChange={(event) => setPaymentForm({ ...paymentForm, due_date: event.target.value })} />
              <textarea placeholder="Payment note" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} />
              <button type="submit" disabled={busyAction === "save-payment"}>
                {busyAction === "save-payment" ? "Recording Payment..." : "Record Payment"}
              </button>
              <div className="mini-list">
                {payments.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <strong>Rs {item.amount}</strong>
                    <p>{labelize(item.payment_type)}</p>
                    <small>{formatDateTime(item.created_at)}</small>
                  </div>
                ))}
                {payments.length === 0 ? <p className="muted">No payments recorded yet.</p> : null}
              </div>
            </form>
          </AccordionSection>
        ) : null}

        {canManageOperations ? (
          <AccordionSection title="Operations tasks" badge={`${operationsTasks.length} tasks`} isOpen={openSection === "operations"} onToggle={() => setOpenSection(openSection === "operations" ? "" : "operations")} summary="Push site visits, delivery, installation, and measurement work into operations.">
            <section className="detail-columns">
              <form className="stack" onSubmit={handleCreateOperationsTask}>
                <select value={operationsTaskForm.task_type} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, task_type: event.target.value })}>
                  <option value="delivery">Delivery</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="installation">Installation</option>
                  <option value="measurement">Measurement</option>
                </select>
                <input placeholder="Task title" value={operationsTaskForm.title} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, title: event.target.value })} />
                <textarea placeholder="Task note" value={operationsTaskForm.note} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, note: event.target.value })} />
                <input type="datetime-local" value={operationsTaskForm.scheduled_for} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, scheduled_for: event.target.value })} />
                <select value={operationsTaskForm.status} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, status: event.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <select value={operationsTaskForm.assigned_to} onChange={(event) => setOperationsTaskForm({ ...operationsTaskForm, assigned_to: event.target.value })}>
                  <option value="">Assign later</option>
                  {users.map((teamMember) => (
                    <option key={teamMember.id} value={teamMember.id}>
                      {teamMember.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={busyAction === "save-operations-task"}>
                  {busyAction === "save-operations-task" ? "Saving Task..." : "Save Task"}
                </button>
              </form>
              <div className="mini-list">
                {operationsTasks.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <strong>{item.title}</strong>
                    <p>{item.note}</p>
                    <small>
                      {labelize(item.task_type)} | {labelize(item.status)} | {formatDateTime(item.scheduled_for)}
                    </small>
                  </div>
                ))}
                {operationsTasks.length === 0 ? <p className="muted">No operations tasks created yet.</p> : null}
              </div>
            </section>
          </AccordionSection>
        ) : null}

        {canManagePlumbing ? (
          <AccordionSection title="Plumbing jobs" badge={`${plumbingJobs.length} jobs`} isOpen={openSection === "plumbing"} onToggle={() => setOpenSection(openSection === "plumbing" ? "" : "plumbing")} summary="Create and complete plumbing jobs directly from the selected lead.">
            <section className="detail-columns">
              <form className="stack" onSubmit={handleCreatePlumbingJob}>
                <select value={plumbingJobForm.plumber_id} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, plumber_id: event.target.value })}>
                  <option value="">Assign plumber later</option>
                  {plumbers.map((plumber) => (
                    <option key={plumber.id} value={plumber.id}>
                      {plumber.name} | {plumber.area || "No area"}
                    </option>
                  ))}
                </select>
                <select value={plumbingJobForm.work_type} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, work_type: event.target.value })}>
                  {plumbingWorkTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select value={plumbingJobForm.status} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, status: event.target.value })}>
                  {plumbingJobStatuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input type="number" placeholder="Service charge" value={plumbingJobForm.service_charge} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, service_charge: event.target.value })} />
                <input type="datetime-local" value={plumbingJobForm.scheduled_for} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, scheduled_for: event.target.value })} />
                <textarea placeholder="Job note" value={plumbingJobForm.note} onChange={(event) => setPlumbingJobForm({ ...plumbingJobForm, note: event.target.value })} />
                <button type="submit" disabled={busyAction === "save-plumbing-job"}>
                  {busyAction === "save-plumbing-job" ? "Saving Job..." : "Save Plumbing Job"}
                </button>
              </form>
              <div className="mini-list">
                {plumbingJobs.map((job) => {
                  const draft = plumbingMaterialDrafts[job.id] || { item_name: "", quantity: "", unit: "pcs", price: "" };
                  return (
                    <div key={job.id} className="timeline-item">
                      <strong>{labelize(job.work_type)}</strong>
                      <p>{job.note || "No plumbing note added."}</p>
                      <small>
                        {labelize(job.status)} | {formatDateTime(job.scheduled_for)}
                      </small>
                      <div className="quote-row">
                        <input placeholder="Material item" value={draft.item_name} onChange={(event) => updatePlumbingMaterialDraft(job.id, "item_name", event.target.value)} />
                        <input type="number" placeholder="Qty" value={draft.quantity} onChange={(event) => updatePlumbingMaterialDraft(job.id, "quantity", event.target.value)} />
                        <input placeholder="Unit" value={draft.unit} onChange={(event) => updatePlumbingMaterialDraft(job.id, "unit", event.target.value)} />
                        <input type="number" placeholder="Price" value={draft.price} onChange={(event) => updatePlumbingMaterialDraft(job.id, "price", event.target.value)} />
                      </div>
                      <div className="lead-actions">
                        <button type="button" className="secondary" onClick={() => handleAddPlumbingMaterial(job.id, job.lead_id)} disabled={busyAction === "save-plumbing-material"}>
                          {busyAction === "save-plumbing-material" ? "Saving Material..." : "Add Material"}
                        </button>
                        {job.status !== "completed" ? (
                          <button type="button" onClick={() => handleUpdatePlumbingJobStatus(job)} disabled={busyAction === "complete-plumbing-job"}>
                            {busyAction === "complete-plumbing-job" ? "Completing..." : "Mark Complete"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {plumbingJobs.length === 0 ? <p className="muted">No plumbing jobs logged for this lead yet.</p> : null}
              </div>
            </section>
          </AccordionSection>
        ) : null}

        {canManageQuotations ? (
          <AccordionSection title="Quotation builder" badge={`${quotations.length} quotations`} isOpen={openSection === "quotations"} onToggle={() => setOpenSection(openSection === "quotations" ? "" : "quotations")} summary="Prepare, save, and share quotations without leaving the lead.">
            <form
              className="stack quotation-form"
              onSubmit={handleCreateQuotation}
              onInputCapture={(event) => clearFieldErrorFromEvent(event, setQuotationFormErrors)}
              onChangeCapture={(event) => clearFieldErrorFromEvent(event, setQuotationFormErrors)}
            >
              <div className="mini-list">
                {quotationForm.items.map((item, index) => (
                  <div key={`quote-item-${index}`} className="timeline-item">
                    <div className="quote-row">
                      <input data-field={`items.${index}.product_name`} className={getFieldErrorClass(quotationFormErrors, `items.${index}.product_name`)} placeholder="Product name" value={item.product_name} onChange={(event) => updateQuotationItem(index, "product_name", event.target.value)} />
                      <input data-field={`items.${index}.tile_size`} className={getFieldErrorClass(quotationFormErrors, `items.${index}.tile_size`)} placeholder="Tile size" value={item.tile_size} onChange={(event) => updateQuotationItem(index, "tile_size", event.target.value)} />
                      <input data-field={`items.${index}.quantity_sqft`} className={getFieldErrorClass(quotationFormErrors, `items.${index}.quantity_sqft`)} type="number" placeholder="Qty sqft" value={item.quantity_sqft} onChange={(event) => updateQuotationItem(index, "quantity_sqft", event.target.value)} />
                      <input data-field={`items.${index}.unit_price`} className={getFieldErrorClass(quotationFormErrors, `items.${index}.unit_price`)} type="number" placeholder="Unit price" value={item.unit_price} onChange={(event) => updateQuotationItem(index, "unit_price", event.target.value)} />
                    </div>
                    {quotationFormErrors?.[`items.${index}.product_name`] ? <span className="field-error-message">{quotationFormErrors[`items.${index}.product_name`]}</span> : null}
                    {quotationFormErrors?.[`items.${index}.tile_size`] ? <span className="field-error-message">{quotationFormErrors[`items.${index}.tile_size`]}</span> : null}
                    {quotationFormErrors?.[`items.${index}.quantity_sqft`] ? <span className="field-error-message">{quotationFormErrors[`items.${index}.quantity_sqft`]}</span> : null}
                    {quotationFormErrors?.[`items.${index}.unit_price`] ? <span className="field-error-message">{quotationFormErrors[`items.${index}.unit_price`]}</span> : null}
                  </div>
                ))}
              </div>
              <div className="lead-actions">
                <button type="button" className="secondary" onClick={addQuotationItem}>
                  Add Quote Item
                </button>
                {products.slice(0, 4).map((product) => (
                  <button key={product.id} type="button" className="secondary" onClick={() => addInventoryProductToQuote(product)}>
                    + {product.name}
                  </button>
                ))}
              </div>
              <input type="number" placeholder="Discount" value={quotationForm.discount} onChange={(event) => setQuotationForm({ ...quotationForm, discount: event.target.value })} />
              <input type="number" placeholder="Transport cost" value={quotationForm.transport_cost} onChange={(event) => setQuotationForm({ ...quotationForm, transport_cost: event.target.value })} />
              <select value={quotationForm.status} onChange={(event) => setQuotationForm({ ...quotationForm, status: event.target.value })}>
                <option value="draft">Draft</option>
                <option value="shared">Shared</option>
                <option value="approved">Approved</option>
              </select>
              <button type="submit" disabled={busyAction === "save-quotation"}>
                {busyAction === "save-quotation" ? "Saving Quotation..." : "Save Quotation"}
              </button>
            </form>
            <div className="mini-list">
              {quotations.map((quotation) => (
                <div key={quotation.id} className="timeline-item">
                  <strong>Quote #{quotation.id}</strong>
                  <p className="muted">Final Rs {quotation.final_amount}</p>
                  {isQuotationExpired(quotation.created_at) ? (
                    <p className="field-error-message">Quotation expired. Recalculate using today&apos;s rate.</p>
                  ) : (
                    <p className="muted">Quotation valid only for today. Rates may change from next day.</p>
                  )}
                  <div className="lead-actions">
                    <button type="button" className="secondary" onClick={() => window.open(getQuotationPdfUrl(selectedLead.id, quotation.id), "_blank")}>
                      Open PDF
                    </button>
                    <button type="button" onClick={() => shareOnWhatsApp(selectedLead.phone, buildQuotationWhatsAppMessage(selectedLead, quotation))}>
                      Share Quote
                    </button>
                  </div>
                </div>
              ))}
              {quotations.length === 0 ? <p className="muted">No quotations for this lead yet.</p> : null}
            </div>
          </AccordionSection>
        ) : null}

        <AccordionSection title="Edit lead" badge={labelize(selectedLead.status)} isOpen={openSection === "lead"} onToggle={() => setOpenSection(openSection === "lead" ? "" : "lead")} summary="Update status, assignment, and core lead details.">
          <form className="form-grid" onSubmit={handleUpdateLead}>
            <input placeholder="Name" value={editingLead.name} onChange={(event) => setEditingLead({ ...editingLead, name: event.target.value })} />
            <input placeholder="Phone" value={editingLead.phone} onChange={(event) => setEditingLead({ ...editingLead, phone: event.target.value })} />
            <input placeholder="Location" value={editingLead.location} onChange={(event) => setEditingLead({ ...editingLead, location: event.target.value })} />
            <select value={editingLead.assigned_to} onChange={(event) => setEditingLead({ ...editingLead, assigned_to: event.target.value })}>
              <option value="">Unassigned</option>
              {users.map((teamMember) => (
                <option key={teamMember.id} value={teamMember.id}>
                  {teamMember.name}
                </option>
              ))}
            </select>
            <select value={editingLead.status} onChange={(event) => setEditingLead({ ...editingLead, status: event.target.value })}>
              <option value="new">New</option>
              <option value="interested">Interested</option>
              <option value="quotation_given">Quotation Given</option>
              <option value="negotiation">Negotiation</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
            <textarea className="full-span" placeholder="Requirement" value={editingLead.requirement} onChange={(event) => setEditingLead({ ...editingLead, requirement: event.target.value })} />
            <button type="submit" className="full-span" disabled={busyAction === "update-lead"}>
              {busyAction === "update-lead" ? "Updating Lead..." : "Update Lead"}
            </button>
          </form>
        </AccordionSection>
      </div>
    </section>
  );
}

export default function LeadWorkspaceSection(props) {
  const {
    currentView,
    overviewTitle,
    overviewSubtitle,
    leadSearch,
    setLeadSearch,
    statusFilter,
    setStatusFilter,
    leadStatuses,
    ListLoadControls,
    leads,
    listLimits,
    increaseListLimit,
    loading,
    filteredLeads,
    selectedLead,
    setSelectedLead,
    setCurrentView,
    isAdmin,
    user,
    setPendingDelete,
    EmptyState,
    normalizeUserRoles,
    editingLead,
    setEditingLead,
    users,
    followupForm,
    setFollowupForm,
    followupFormErrors = {},
    setFollowupFormErrors = () => {},
    paymentForm,
    setPaymentForm,
    quotationForm,
    setQuotationForm,
    quotationFormErrors = {},
    setQuotationFormErrors = () => {},
    followups,
    payments,
    quotations,
    operationsTasks,
    leadPlumbingJobs,
    plumbers,
    plumbingJobForm,
    setPlumbingJobForm,
    plumbingMaterialDrafts,
    updatePlumbingMaterialDraft,
    products,
    handleUpdateLead,
    handleCreateFollowup,
    handleCreatePayment,
    handleCreateOperationsTask,
    handleCreateQuotation,
    handleCreatePlumbingJob,
    requestPlumbingJobComplete,
    handleAddPlumbingMaterial,
    operationsTaskForm,
    setOperationsTaskForm,
    updateQuotationItem,
    addQuotationItem,
    addInventoryProductToQuote,
    busyAction,
    focusedFollowupBoard,
    overdueFollowups,
    todaysFollowups,
    BadgeCard,
    formatDateTime,
    labelize,
    requestMarkFollowupDone,
    focusedOperationsBoard,
    focusStats,
    requestMarkOperationsTaskDone,
    pipelineColumns,
    shareOnWhatsApp,
    buildFollowupWhatsAppMessage,
    buildVisitReminderMessage,
    buildQuotationWhatsAppMessage,
    getQuotationPdfUrl,
    followupTypes,
    paymentTypes,
    plumbingWorkTypes,
    plumbingJobStatuses,
    clearFieldErrorFromEvent = () => {},
    getFieldErrorClass = () => "",
  } = props;

  if (currentView === "overview") {
    const displayLeads = filteredLeads
      .slice(0, 8)
      .map((lead) => ({
        ...lead,
        status_label: labelize(lead.status),
        business_unit_label: labelize(lead.business_unit),
        department_label: labelize(lead.department),
        customer_type_label: labelize(lead.customer_type),
      }));

    return (
      <section className="content-grid lead-workspace-layout">
        <section className="panel">
          <div className="section-head">
            <h2>{overviewTitle}</h2>
            <span>{overviewSubtitle}</span>
          </div>
          <div className="filter-row">
            <input placeholder="Search name, phone, area, source" value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {leadStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <ListLoadControls count={leads.length} limit={listLimits.leads} onLoadMore={() => increaseListLimit("leads")} disabled={loading} />
          <div className="list">
            {displayLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selected={selectedLead?.id === lead.id}
                onSelect={() => setSelectedLead(lead)}
                canDelete={isAdmin(user)}
                formatDateTime={formatDateTime}
                onDelete={() =>
                  setPendingDelete({
                    type: "lead",
                    id: lead.id,
                    entityLabel: "Lead",
                    message: `This will permanently remove lead ${lead.name}.`,
                    subtext: `${lead.phone} | ${lead.location || "No area"}`,
                  })
                }
              />
            ))}
            {filteredLeads.length === 0 ? <EmptyState title="No leads match these filters" message="Clear the filters or add a new lead to start the showroom funnel." /> : null}
          </div>
        </section>

        <LeadDetailsPanel
          className="lead-details-panel-overview"
          selectedLead={selectedLead}
          userRoles={normalizeUserRoles(user)}
          editingLead={editingLead}
          setEditingLead={setEditingLead}
          users={users}
          followupForm={followupForm}
          setFollowupForm={setFollowupForm}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          quotationForm={quotationForm}
          setQuotationForm={setQuotationForm}
          followups={followups}
          payments={payments}
          quotations={quotations}
          operationsTasks={operationsTasks}
          plumbingJobs={leadPlumbingJobs}
          plumbers={plumbers}
          plumbingJobForm={plumbingJobForm}
          setPlumbingJobForm={setPlumbingJobForm}
          plumbingMaterialDrafts={plumbingMaterialDrafts}
          updatePlumbingMaterialDraft={updatePlumbingMaterialDraft}
          products={products}
          handleUpdateLead={handleUpdateLead}
          handleCreateFollowup={handleCreateFollowup}
          handleCreatePayment={handleCreatePayment}
          handleCreateOperationsTask={handleCreateOperationsTask}
          handleCreateQuotation={handleCreateQuotation}
          handleCreatePlumbingJob={handleCreatePlumbingJob}
          handleUpdatePlumbingJobStatus={requestPlumbingJobComplete}
          handleAddPlumbingMaterial={handleAddPlumbingMaterial}
          operationsTaskForm={operationsTaskForm}
          setOperationsTaskForm={setOperationsTaskForm}
          updateQuotationItem={updateQuotationItem}
          addQuotationItem={addQuotationItem}
          addInventoryProductToQuote={addInventoryProductToQuote}
          busyAction={busyAction}
          followupTypes={followupTypes}
          paymentTypes={paymentTypes}
          plumbingWorkTypes={plumbingWorkTypes}
          plumbingJobStatuses={plumbingJobStatuses}
          labelize={labelize}
          formatDateTime={formatDateTime}
          shareOnWhatsApp={shareOnWhatsApp}
          buildFollowupWhatsAppMessage={buildFollowupWhatsAppMessage}
          buildVisitReminderMessage={buildVisitReminderMessage}
          buildQuotationWhatsAppMessage={buildQuotationWhatsAppMessage}
          getQuotationPdfUrl={getQuotationPdfUrl}
        />
      </section>
    );
  }

  if (currentView === "pipeline") {
    return (
      <section className="stack lead-workspace-layout-pipeline">
        <section className="panel">
          <div className="section-head">
            <h2>Sales pipeline</h2>
            <span>Move every inquiry through the showroom process</span>
          </div>
          {filteredLeads.length ? (
            <>
              <div className="pipeline-board">
                {pipelineColumns.map((column) => (
                  <section key={column.value} className="pipeline-column">
                    <div className="pipeline-header">
                      <h3>{column.label}</h3>
                      <span>{column.leads.length}</span>
                    </div>
                    <div className="stack">
                      {column.leads.map((lead) => (
                        <article key={lead.id} className={`lead-card compact-card ${selectedLead?.id === lead.id ? "active" : ""}`} onClick={() => setSelectedLead(lead)}>
                          <strong>{lead.name}</strong>
                          <small className="muted lead-card-line">{lead.phone} | {lead.location || "No area"}</small>
                          <small className="muted lead-card-line">
                            Budget Rs {lead.budget || 0} | Next follow-up: {lead.latest_followup ? formatDateTime(lead.latest_followup) : "Not scheduled"}
                          </small>
                          <div className="lead-card-footer">
                            <span className={`status-chip status-${lead.status}`}>{labelize(lead.status)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <ListLoadControls count={leads.length} limit={listLimits.leads} onLoadMore={() => increaseListLimit("leads")} disabled={loading} />
            </>
          ) : (
            <EmptyState title="No leads in the pipeline" message="Create a lead or change the filters to see the funnel columns fill up." />
          )}
        </section>

        <LeadDetailsPanel
          className="lead-details-panel-pipeline"
          selectedLead={selectedLead}
          userRoles={normalizeUserRoles(user)}
          editingLead={editingLead}
          setEditingLead={setEditingLead}
          users={users}
          followupForm={followupForm}
          setFollowupForm={setFollowupForm}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          quotationForm={quotationForm}
          setQuotationForm={setQuotationForm}
          followups={followups}
          payments={payments}
          quotations={quotations}
          operationsTasks={operationsTasks}
          plumbingJobs={leadPlumbingJobs}
          plumbers={plumbers}
          plumbingJobForm={plumbingJobForm}
          setPlumbingJobForm={setPlumbingJobForm}
          plumbingMaterialDrafts={plumbingMaterialDrafts}
          updatePlumbingMaterialDraft={updatePlumbingMaterialDraft}
          products={products}
          handleUpdateLead={handleUpdateLead}
          handleCreateFollowup={handleCreateFollowup}
          handleCreatePayment={handleCreatePayment}
          handleCreateOperationsTask={handleCreateOperationsTask}
          handleCreateQuotation={handleCreateQuotation}
          handleCreatePlumbingJob={handleCreatePlumbingJob}
          handleUpdatePlumbingJobStatus={requestPlumbingJobComplete}
          handleAddPlumbingMaterial={handleAddPlumbingMaterial}
          operationsTaskForm={operationsTaskForm}
          setOperationsTaskForm={setOperationsTaskForm}
          updateQuotationItem={updateQuotationItem}
          addQuotationItem={addQuotationItem}
          addInventoryProductToQuote={addInventoryProductToQuote}
          busyAction={busyAction}
          followupTypes={followupTypes}
          paymentTypes={paymentTypes}
          plumbingWorkTypes={plumbingWorkTypes}
          plumbingJobStatuses={plumbingJobStatuses}
          labelize={labelize}
          formatDateTime={formatDateTime}
          shareOnWhatsApp={shareOnWhatsApp}
          buildFollowupWhatsAppMessage={buildFollowupWhatsAppMessage}
          buildVisitReminderMessage={buildVisitReminderMessage}
          buildQuotationWhatsAppMessage={buildQuotationWhatsAppMessage}
          getQuotationPdfUrl={getQuotationPdfUrl}
        />
      </section>
    );
  }

  if (currentView === "followups") {
    return (
      <section className="content-grid">
        <section className="panel">
          <div className="section-head">
            <h2>Follow-up board</h2>
            <span>Calls, WhatsApp, visits, reminders</span>
          </div>
          <div className="tabs-row">
            <BadgeCard title="Overdue" count={overdueFollowups.length} tone="danger" />
            <BadgeCard title="Today" count={todaysFollowups.length} tone="accent" />
            <BadgeCard title="Upcoming" count={focusedFollowupBoard.filter((item) => item.computed_status === "pending").length} />
          </div>
          <div className="list">
            {focusedFollowupBoard.map((item) => (
              <article key={item.id} className="lead-card">
                <div className="section-head">
                  <div>
                    <h3>{item.lead_name}</h3>
                    <p className="muted">{item.lead_phone}</p>
                  </div>
                  <span className={`status-chip status-${item.computed_status}`}>{labelize(item.computed_status)}</span>
                </div>
                <p>{item.note}</p>
                <p className="muted">
                  {labelize(item.followup_type)} | {formatDateTime(item.followup_date)}
                </p>
                <div className="lead-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const target = leads.find((lead) => lead.id === item.lead_id);
                      if (target) {
                        setSelectedLead(target);
                        setCurrentView("overview");
                      }
                    }}
                  >
                    Open Lead
                  </button>
                  {item.computed_status !== "completed" ? (
                    <button type="button" onClick={() => requestMarkFollowupDone(item)} disabled={busyAction === "complete-followup"}>
                      Mark Done
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {focusedFollowupBoard.length === 0 ? <EmptyState title="No follow-ups pending" message="Your calls, WhatsApp nudges, and reminders will appear here automatically." /> : null}
          </div>
        </section>
      </section>
    );
  }

  if (currentView === "operations") {
    return (
      <section className="content-grid">
        <section className="panel">
          <div className="section-head">
            <h2>Operations board</h2>
            <span>{focusStats.openOpsTasks} open tasks</span>
          </div>
          <div className="tabs-row">
            <BadgeCard title="Delayed" count={focusStats.delayedOpsTasks} tone="danger" />
            <BadgeCard title="Open" count={focusStats.openOpsTasks} tone="accent" />
            <BadgeCard title="Ops Leads" count={focusStats.operationsLeads} />
          </div>
          <div className="list">
            {focusedOperationsBoard.map((task) => (
              <article key={task.id} className={`lead-card unit-${task.business_unit || "tiles"}`}>
                <div className="section-head">
                  <div>
                    <h3>{task.title}</h3>
                    <p className="muted">
                      {task.lead_name} | {task.lead_location || "No area"}
                    </p>
                  </div>
                  <span className={`status-chip status-${task.status}`}>{labelize(task.status)}</span>
                </div>
                <p>{task.note || "No task note added."}</p>
                <p className="muted">
                  {labelize(task.task_type)} | {formatDateTime(task.scheduled_for)} | {task.assigned_to_name || "Unassigned"}
                </p>
                <div className="lead-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const target = leads.find((lead) => lead.id === task.lead_id);
                      if (target) {
                        setSelectedLead(target);
                        setCurrentView("overview");
                      }
                    }}
                  >
                    Open Lead
                  </button>
                  {task.status !== "completed" ? (
                    <button type="button" onClick={() => requestMarkOperationsTaskDone(task)} disabled={busyAction === "complete-operations-task"}>
                      Mark Done
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {focusedOperationsBoard.length === 0 ? <EmptyState title="No operations tasks yet" message="Site visits, delivery, and installation tasks will appear here once created." /> : null}
          </div>
        </section>
      </section>
    );
  }

  return null;
}
