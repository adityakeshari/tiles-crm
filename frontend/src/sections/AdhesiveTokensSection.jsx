export default function AdhesiveTokensSection(props) {
  const {
    schemeSummary,
    BadgeCard,
    handleIssueSchemeToken,
    schemeTokenForm,
    setSchemeTokenForm,
    schemeTokenFormErrors,
    setSchemeTokenFormErrors,
    activeMasons,
    handleRegisteredMasonChange,
    handleVerifyAdhesiveInvoice,
    projects,
    handleAdhesiveProjectChange,
    sanitizePositiveIntegerInput,
    sanitizeNonNegativeIntegerInput,
    addAdhesiveTokenItemRow,
    adhesiveTokenValues,
    handleAdhesiveTokenItemChange,
    removeAdhesiveTokenItemRow,
    selectedRegisteredMason,
    HighlightRow,
    adhesiveClaimTotals,
    selectedAdhesiveProject,
    getAdhesiveClaimPreviewStatus,
    labelize,
    busyAction,
    editingAdhesiveTokenId,
    setEditingAdhesiveTokenId,
    emptySchemeToken,
    ListLoadControls,
    schemeTokens,
    listLimits,
    increaseListLimit,
    loading,
    adhesiveTokenStatusFilter,
    setAdhesiveTokenStatusFilter,
    adhesiveTokenStatuses,
    adhesiveTokenMasonFilter,
    setAdhesiveTokenMasonFilter,
    adhesiveTokenInvoiceFilter,
    setAdhesiveTokenInvoiceFilter,
    adhesiveTokenSiteFilter,
    setAdhesiveTokenSiteFilter,
    adhesiveTokenCreatedByFilter,
    setAdhesiveTokenCreatedByFilter,
    adhesiveTokenVerifiedByFilter,
    setAdhesiveTokenVerifiedByFilter,
    adhesiveTokenDateFromFilter,
    setAdhesiveTokenDateFromFilter,
    adhesiveTokenDateToFilter,
    setAdhesiveTokenDateToFilter,
    adhesiveTokenReports,
    StatCard,
    filteredSchemeTokens,
    user,
    getAdhesiveClaimActionState,
    handleOpenAdhesiveTokenDetail,
    startEditingAdhesiveToken,
    requestVerifyAdhesiveToken,
    requestApproveAdhesiveToken,
    requestMarkAdhesiveTokenPaid,
    requestRejectAdhesiveToken,
    requestReopenAdhesiveToken,
    requestDeleteAdhesiveToken,
    formatDateTime,
    selectedAdhesiveToken,
    adhesiveTokenActivities,
    clearFieldErrorFromEvent,
    getFieldErrorClass,
  } = props;

  const selectedClaimActionState = selectedAdhesiveToken ? getAdhesiveClaimActionState(selectedAdhesiveToken, user) : null;

  return (
    <section className="content-grid">
      <section className="panel">
        <div className="section-head">
          <h2>Add adhesive token claim</h2>
          <span>Create one verified claim with multiple token line items</span>
        </div>

        <div className="tabs-row">
          <BadgeCard title="Pending Approved Payout" count={`Rs ${schemeSummary?.pending_token_payout ?? 0}`} tone="danger" />
          <BadgeCard title="Paid Payout" count={`Rs ${schemeSummary?.paid_token_payout ?? 0}`} tone="accent" />
          <BadgeCard title="Mismatch Claims" count={schemeSummary?.mismatch_claims ?? 0} />
          <BadgeCard title="Rejected Claims" count={schemeSummary?.rejected_claims ?? 0} tone="danger" />
        </div>

        <form
          className="form-grid"
          onSubmit={handleIssueSchemeToken}
          onInputCapture={(event) => clearFieldErrorFromEvent(event, setSchemeTokenFormErrors)}
          onChangeCapture={(event) => clearFieldErrorFromEvent(event, setSchemeTokenFormErrors)}
        >
          <p className="full-span muted">Token claim can be created with Site + Mason + Invoice. Project/customer linking is optional.</p>
          <div className="form-field">
            <input data-field="site_name" className={getFieldErrorClass(schemeTokenFormErrors, "site_name")} placeholder="Site name" value={schemeTokenForm.site_name} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, site_name: event.target.value })} />
            {schemeTokenFormErrors?.site_name ? <span className="field-error-message">{schemeTokenFormErrors.site_name}</span> : null}
          </div>
          <div className="form-field">
            <input data-field="invoice_number" className={getFieldErrorClass(schemeTokenFormErrors, "invoice_number")} placeholder="Invoice / bill number" value={schemeTokenForm.invoice_number} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, invoice_number: event.target.value })} />
            {schemeTokenFormErrors?.invoice_number ? <span className="field-error-message">{schemeTokenFormErrors.invoice_number}</span> : null}
          </div>
          <div className="form-field">
            <select data-field="mason_id" className={getFieldErrorClass(schemeTokenFormErrors, "mason_id")} value={schemeTokenForm.mason_id} onChange={(event) => handleRegisteredMasonChange(event.target.value)}>
              <option value="">Select registered mason</option>
              {activeMasons.map((mason) => (
                <option key={mason.id} value={mason.id}>
                  {mason.name} | {mason.mobile} | {mason.area || "No area"}
                </option>
              ))}
            </select>
            {schemeTokenFormErrors?.mason_id ? <span className="field-error-message">{schemeTokenFormErrors.mason_id}</span> : null}
          </div>
          <button type="button" className="secondary" onClick={handleVerifyAdhesiveInvoice}>
            Verify Invoice
          </button>
          <input placeholder="Registered mason mobile" value={schemeTokenForm.mason_mobile} readOnly />
          <input placeholder="Current address city" value={schemeTokenForm.mason_current_address_city} readOnly />
          <input placeholder="Permanent address city" value={schemeTokenForm.mason_permanent_address_city} readOnly />
          <input placeholder="Working areas" value={(schemeTokenForm.mason_working_areas || []).join(", ")} readOnly />
          <input placeholder="Working distance upto (KM)" value={schemeTokenForm.mason_working_distance_upto_km} readOnly />
          <div className="form-field">
            <input data-field="adhesive_type" className={getFieldErrorClass(schemeTokenFormErrors, "adhesive_type")} placeholder="Adhesive type" value={schemeTokenForm.adhesive_type} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, adhesive_type: event.target.value })} />
            {schemeTokenFormErrors?.adhesive_type ? <span className="field-error-message">{schemeTokenFormErrors.adhesive_type}</span> : null}
          </div>
          <div className="form-field">
            <input data-field="adhesive_company" className={getFieldErrorClass(schemeTokenFormErrors, "adhesive_company")} placeholder="Adhesive company" value={schemeTokenForm.adhesive_company} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, adhesive_company: event.target.value })} />
            {schemeTokenFormErrors?.adhesive_company ? <span className="field-error-message">{schemeTokenFormErrors.adhesive_company}</span> : null}
          </div>
          <div className="form-field">
            <input
              data-field="sold_bag_quantity"
              className={getFieldErrorClass(schemeTokenFormErrors, "sold_bag_quantity")}
              type="number"
              min="1"
              placeholder="Sold bag quantity"
              value={schemeTokenForm.sold_bag_quantity}
              onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, sold_bag_quantity: sanitizePositiveIntegerInput(event.target.value, "") })}
            />
            {schemeTokenFormErrors?.sold_bag_quantity ? <span className="field-error-message">{schemeTokenFormErrors.sold_bag_quantity}</span> : null}
          </div>
          <div className="full-span detail-card stack">
            <div className="section-head">
              <h3>Token line items</h3>
              <button type="button" className="secondary" onClick={addAdhesiveTokenItemRow}>
                Add Row
              </button>
            </div>
            <div className="mini-list">
              {(schemeTokenForm.items || []).map((item, index) => {
                const isPresetValue = adhesiveTokenValues.some((option) => Number(option.value) === Number(item.token_value));
                return (
                  <div key={`claim-item-${index}`} className="timeline-item">
                    <div className="form-grid">
                      <select
                        data-field={`items.${index}.token_value`}
                        className={getFieldErrorClass(schemeTokenFormErrors, `items.${index}.token_value`)}
                        value={isPresetValue ? String(item.token_value) : "custom"}
                        onChange={(event) => {
                          if (event.target.value === "custom") {
                            handleAdhesiveTokenItemChange(index, "token_value", "");
                            return;
                          }
                          handleAdhesiveTokenItemChange(index, "token_value", event.target.value);
                        }}
                      >
                        {adhesiveTokenValues.map((option) => (
                          <option key={option.value} value={option.value}>
                            Token Value Rs {option.label}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                      {!isPresetValue ? (
                        <input
                          data-field={`items.${index}.token_value`}
                          className={getFieldErrorClass(schemeTokenFormErrors, `items.${index}.token_value`)}
                          type="number"
                          min="0"
                          placeholder="Custom token value"
                          value={item.token_value}
                          onChange={(event) => handleAdhesiveTokenItemChange(index, "token_value", sanitizeNonNegativeIntegerInput(event.target.value, ""))}
                        />
                      ) : (
                        <input
                          data-field={`items.${index}.quantity`}
                          className={getFieldErrorClass(schemeTokenFormErrors, `items.${index}.quantity`)}
                          type="number"
                          min="1"
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(event) => handleAdhesiveTokenItemChange(index, "quantity", sanitizePositiveIntegerInput(event.target.value, 1))}
                        />
                      )}
                      {isPresetValue ? null : (
                        <input
                          data-field={`items.${index}.quantity`}
                          className={getFieldErrorClass(schemeTokenFormErrors, `items.${index}.quantity`)}
                          type="number"
                          min="1"
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(event) => handleAdhesiveTokenItemChange(index, "quantity", sanitizePositiveIntegerInput(event.target.value, 1))}
                        />
                      )}
                      <div className="mini-card">
                        <strong>Line Total</strong>
                        <span>Rs {Number(item.token_value || 0) * Number(item.quantity || 0)}</span>
                      </div>
                      <button type="button" className="secondary" onClick={() => removeAdhesiveTokenItemRow(index)} disabled={(schemeTokenForm.items || []).length === 1}>
                        Remove Row
                      </button>
                    </div>
                    {schemeTokenFormErrors?.[`items.${index}.token_value`] ? <span className="field-error-message">{schemeTokenFormErrors[`items.${index}.token_value`]}</span> : null}
                    {schemeTokenFormErrors?.[`items.${index}.quantity`] ? <span className="field-error-message">{schemeTokenFormErrors[`items.${index}.quantity`]}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <textarea className="full-span" placeholder="Remarks" value={schemeTokenForm.remarks} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, remarks: event.target.value })} />
          <select value={schemeTokenForm.project_id} onChange={(event) => handleAdhesiveProjectChange(event.target.value)}>
            <option value="">Optional project link</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_name} | {project.lead_name}
              </option>
            ))}
          </select>
          <input placeholder="Optional customer name" value={schemeTokenForm.customer_name} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, customer_name: event.target.value })} />
          <div className="form-field">
            <input data-field="sale_date" className={getFieldErrorClass(schemeTokenFormErrors, "sale_date")} type="date" value={schemeTokenForm.sale_date} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, sale_date: event.target.value })} />
            {schemeTokenFormErrors?.sale_date ? <span className="field-error-message">{schemeTokenFormErrors.sale_date}</span> : null}
          </div>
          <input placeholder="Token / bag photo URL" value={schemeTokenForm.token_photo_url} onChange={(event) => setSchemeTokenForm({ ...schemeTokenForm, token_photo_url: event.target.value })} />
          <div className="detail-card stack full-span">
            <div className="section-head">
              <strong>Registered Mason</strong>
              <span className={`status-chip ${selectedRegisteredMason ? "unit-chip unit-plumbing" : "status-pending"}`}>
                {selectedRegisteredMason ? `Registered Mason: ${selectedRegisteredMason.name}` : "Select active registered mason"}
              </span>
            </div>
            {selectedRegisteredMason ? (
              <p className="muted">
                {selectedRegisteredMason.current_address_city || "No current city"} | {selectedRegisteredMason.permanent_address_city || "No permanent city"} | {(selectedRegisteredMason.working_areas || []).join(", ") || "No working areas"} | {selectedRegisteredMason.working_distance_upto_km || 0} KM
              </p>
            ) : null}
            <HighlightRow label="Claimed Bag Quantity" value={adhesiveClaimTotals.claimed_bag_quantity} />
            <HighlightRow label="Sold Bag Quantity" value={schemeTokenForm.sold_bag_quantity || 0} />
            <HighlightRow label="Sold vs Claimed" value={`${schemeTokenForm.sold_bag_quantity || 0} sold / ${adhesiveClaimTotals.claimed_bag_quantity} claimed`} />
            <HighlightRow label="Total Token Amount" value={`Rs ${adhesiveClaimTotals.total_token_amount}`} tone="accent" />
            <div className="section-head">
              <strong>Verification Badge</strong>
              <span className={`status-chip status-${getAdhesiveClaimPreviewStatus(schemeTokenForm, selectedAdhesiveProject)}`}>
                {labelize(getAdhesiveClaimPreviewStatus(schemeTokenForm, selectedAdhesiveProject))}
              </span>
            </div>
            {getAdhesiveClaimPreviewStatus(schemeTokenForm, selectedAdhesiveProject) === "mismatch" ? <p className="muted">Warning: claimed bag quantity exceeds sold quantity or optional customer does not match the linked project.</p> : null}
            {getAdhesiveClaimPreviewStatus(schemeTokenForm, selectedAdhesiveProject) === "unverified" ? <p className="muted">Invoice preview stays unverified until you optionally link a project and matching customer.</p> : null}
          </div>
          <div className="full-span lead-actions">
            <button
              type="submit"
              disabled={busyAction === "issue-token" || !selectedRegisteredMason || String(selectedRegisteredMason.status || "").toLowerCase() !== "active"}
            >
              {!selectedRegisteredMason || String(selectedRegisteredMason.status || "").toLowerCase() !== "active"
                ? "Select Active Registered Mason"
                : busyAction === "issue-token"
                  ? editingAdhesiveTokenId
                    ? "Updating Adhesive Claim..."
                    : "Saving Adhesive Claim..."
                  : editingAdhesiveTokenId
                    ? "Update Adhesive Claim"
                    : "Save Adhesive Claim"}
            </button>
            {editingAdhesiveTokenId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingAdhesiveTokenId(null);
                  setSchemeTokenForm(emptySchemeToken);
                  setSchemeTokenFormErrors({});
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Adhesive claim ledger</h2>
          <span>{filteredSchemeTokens.length} claims</span>
        </div>
        <ListLoadControls count={schemeTokens.length} limit={listLimits.claims} onLoadMore={() => increaseListLimit("claims")} disabled={loading} />

        <div className="form-grid">
          <select value={adhesiveTokenStatusFilter} onChange={(event) => setAdhesiveTokenStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {adhesiveTokenStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input placeholder="Filter by mason or mobile" value={adhesiveTokenMasonFilter} onChange={(event) => setAdhesiveTokenMasonFilter(event.target.value)} />
          <input placeholder="Filter by invoice number" value={adhesiveTokenInvoiceFilter} onChange={(event) => setAdhesiveTokenInvoiceFilter(event.target.value)} />
          <input placeholder="Filter by site" value={adhesiveTokenSiteFilter} onChange={(event) => setAdhesiveTokenSiteFilter(event.target.value)} />
          <input placeholder="Filter by created by" value={adhesiveTokenCreatedByFilter} onChange={(event) => setAdhesiveTokenCreatedByFilter(event.target.value)} />
          <input placeholder="Filter by verified by" value={adhesiveTokenVerifiedByFilter} onChange={(event) => setAdhesiveTokenVerifiedByFilter(event.target.value)} />
          <input type="date" value={adhesiveTokenDateFromFilter} onChange={(event) => setAdhesiveTokenDateFromFilter(event.target.value)} />
          <input type="date" value={adhesiveTokenDateToFilter} onChange={(event) => setAdhesiveTokenDateToFilter(event.target.value)} />
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setAdhesiveTokenStatusFilter("all");
              setAdhesiveTokenMasonFilter("");
              setAdhesiveTokenInvoiceFilter("");
              setAdhesiveTokenSiteFilter("");
              setAdhesiveTokenCreatedByFilter("");
              setAdhesiveTokenVerifiedByFilter("");
              setAdhesiveTokenDateFromFilter("");
              setAdhesiveTokenDateToFilter("");
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="report-grid">
          <StatCard label="Mason-Wise" value={adhesiveTokenReports?.mason_wise?.length ?? 0} />
          <StatCard label="Company-Wise" value={adhesiveTokenReports?.company_wise?.length ?? 0} />
          <StatCard label="Site-Wise" value={adhesiveTokenReports?.site_wise?.length ?? 0} />
          <StatCard label="Monthly Reports" value={adhesiveTokenReports?.monthly_payout?.length ?? 0} />
        </div>

        <div className="list">
          {filteredSchemeTokens.map((claim) => {
            const actionState = getAdhesiveClaimActionState(claim, user);

            return (
              <article key={claim.id} className="lead-card adhesive-claim-card">
                <div className="section-head">
                  <div>
                    <h3>{claim.site_name}</h3>
                    <p className="muted adhesive-claim-meta">
                      {claim.mason_name} | {claim.mason_mobile || "No mobile"} | {claim.invoice_number}
                    </p>
                  </div>
                  <span className={`status-chip status-${claim.verification_status}`}>{labelize(claim.verification_status)}</span>
                </div>
                <p className="adhesive-claim-line">
                  {claim.adhesive_type || "No adhesive type"} | Rs {claim.total_token_amount} | {labelize(claim.status)}
                </p>
                <p className="muted adhesive-claim-line">
                  Created by {claim.created_by_user_name || "Not available"} | {formatDateTime(claim.created_at)}
                </p>
                <p className="muted adhesive-claim-line">
                  Verified by {claim.verified_by_user_name || "Not available"} | {formatDateTime(claim.verified_at)}
                </p>
                <div className="adhesive-actions-grid">
                      <button type="button" className="secondary" onClick={() => handleOpenAdhesiveTokenDetail(claim.id)}>
                    View Detail
                  </button>
                  <button type="button" className="secondary" onClick={() => startEditingAdhesiveToken(claim)} disabled={!actionState.canEdit} title={actionState.canEdit ? "Edit claim" : actionState.editHint}>
                    Edit
                  </button>
                  <button type="button" onClick={() => requestVerifyAdhesiveToken(claim)} disabled={!actionState.canVerify} title={actionState.canVerify ? "Verify invoice" : actionState.verifyHint}>
                    Verify Invoice
                  </button>
                  <button type="button" onClick={() => requestApproveAdhesiveToken(claim)} disabled={!actionState.canApprove} title={actionState.canApprove ? "Approve claim" : actionState.approveHint}>
                    Approve Claim
                  </button>
                  <button type="button" onClick={() => requestMarkAdhesiveTokenPaid(claim)} disabled={!actionState.canMarkPaid} title={actionState.canMarkPaid ? "Mark claim paid" : actionState.payHint}>
                    Mark Paid
                  </button>
                  <button type="button" className="secondary" onClick={() => requestReopenAdhesiveToken(claim)} disabled={!actionState.canReopen} title={actionState.canReopen ? "Reopen claim" : actionState.reopenHint}>
                    Reopen Claim
                  </button>
                  <button type="button" className="secondary" onClick={() => requestRejectAdhesiveToken(claim)} disabled={!actionState.canReject} title={actionState.canReject ? "Reject claim" : actionState.rejectHint}>
                    Reject Claim
                  </button>
                  <button type="button" className="danger" onClick={() => requestDeleteAdhesiveToken(claim)} disabled={!actionState.canDelete} title={actionState.canDelete ? "Delete claim" : actionState.deleteHint}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="stack">
          <h3>Selected claim detail</h3>
          {selectedAdhesiveToken ? (
            <div className="detail-card stack">
              <div className="adhesive-actions-grid">
                <button type="button" className="secondary" onClick={() => handleOpenAdhesiveTokenDetail(selectedAdhesiveToken.id)}>
                  View Detail
                </button>
                <button type="button" className="secondary" onClick={() => startEditingAdhesiveToken(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canEdit} title={selectedClaimActionState?.canEdit ? "Edit claim" : selectedClaimActionState?.editHint}>
                  Edit
                </button>
                <button type="button" onClick={() => requestApproveAdhesiveToken(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canApprove} title={selectedClaimActionState?.canApprove ? "Approve claim" : selectedClaimActionState?.approveHint}>
                  Approve Claim
                </button>
                <button type="button" className="secondary" onClick={() => requestReopenAdhesiveToken(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canReopen} title={selectedClaimActionState?.canReopen ? "Reopen claim" : selectedClaimActionState?.reopenHint}>
                  Reopen Claim
                </button>
                <button type="button" onClick={() => requestMarkAdhesiveTokenPaid(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canMarkPaid} title={selectedClaimActionState?.canMarkPaid ? "Mark claim paid" : selectedClaimActionState?.payHint}>
                  Mark Paid
                </button>
                <button type="button" className="secondary" onClick={() => requestRejectAdhesiveToken(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canReject} title={selectedClaimActionState?.canReject ? "Reject claim" : selectedClaimActionState?.rejectHint}>
                  Reject Claim
                </button>
                <button type="button" className="danger" onClick={() => requestDeleteAdhesiveToken(selectedAdhesiveToken)} disabled={!selectedClaimActionState?.canDelete} title={selectedClaimActionState?.canDelete ? "Delete claim" : selectedClaimActionState?.deleteHint}>
                  Delete Claim
                </button>
              </div>
              <HighlightRow label="Site" value={selectedAdhesiveToken.site_name} />
              <HighlightRow label="Project" value={selectedAdhesiveToken.project_name || "No linked project"} />
              <HighlightRow label="Invoice Number" value={selectedAdhesiveToken.invoice_number} />
              <HighlightRow label="Sale Date" value={selectedAdhesiveToken.sale_date || "No sale date"} />
              <HighlightRow label="Customer" value={selectedAdhesiveToken.customer_name || "No linked customer"} />
              <HighlightRow label="Mason" value={`${selectedAdhesiveToken.mason_name} | ${selectedAdhesiveToken.mason_mobile}`} />
              <HighlightRow label="Adhesive" value={`${selectedAdhesiveToken.adhesive_company} | ${selectedAdhesiveToken.adhesive_type}`} />
              <HighlightRow label="Created By" value={selectedAdhesiveToken.created_by_user_name || "Not available"} />
              <HighlightRow label="Created At" value={formatDateTime(selectedAdhesiveToken.created_at)} />
              <HighlightRow label="Verified By" value={selectedAdhesiveToken.verified_by_user_name || "Not available"} />
              <HighlightRow label="Verified At" value={formatDateTime(selectedAdhesiveToken.verified_at)} />
              <HighlightRow label="Approved By" value={selectedAdhesiveToken.approved_by_user_name || "Not available"} />
              <HighlightRow label="Approved At" value={formatDateTime(selectedAdhesiveToken.approved_at)} />
              <HighlightRow label="Rejected By" value={selectedAdhesiveToken.rejected_by_user_name || "Not available"} />
              <HighlightRow label="Rejected At" value={formatDateTime(selectedAdhesiveToken.rejected_at)} />
              <HighlightRow label="Paid By" value={selectedAdhesiveToken.paid_by_user_name || "Not available"} />
              <HighlightRow label="Paid At" value={formatDateTime(selectedAdhesiveToken.paid_at)} />
              <HighlightRow label="Sold Bag Quantity" value={selectedAdhesiveToken.sold_bag_quantity} />
              <HighlightRow label="Claimed Bag Quantity" value={selectedAdhesiveToken.claimed_bag_quantity} />
              <HighlightRow label="Total Token Amount" value={`Rs ${selectedAdhesiveToken.total_token_amount}`} tone="accent" />
              <HighlightRow label="Status" value={labelize(selectedAdhesiveToken.status)} />
              <HighlightRow label="Verification" value={labelize(selectedAdhesiveToken.verification_status)} />
              <HighlightRow label="Payment Date" value={selectedAdhesiveToken.payment_date || "Not paid yet"} />
              <HighlightRow label="Remarks" value={selectedAdhesiveToken.remarks || "No remarks"} />
              <div className="mini-list">
                {(selectedAdhesiveToken.items || []).map((item) => (
                  <div key={item.id} className="timeline-item">
                    <strong>Token Value Rs {item.token_value}</strong>
                    <p className="muted">Quantity {item.quantity}</p>
                    <p>Line Total Rs {item.line_total}</p>
                  </div>
                ))}
                {!selectedAdhesiveToken.items?.length ? <p className="muted">No claim line items found.</p> : null}
              </div>
              {selectedAdhesiveToken.token_photo_url ? (
                <a href={selectedAdhesiveToken.token_photo_url} target="_blank" rel="noreferrer">
                  Open token photo
                </a>
              ) : (
                <p className="muted">No token photo attached.</p>
              )}
              <div className="mini-list">
                <h4>User Activity Timeline</h4>
                {(selectedAdhesiveToken.activities || []).map((item) => (
                  <div key={item.id} className="timeline-item">
                    <strong>{labelize(item.action)}</strong>
                    <p className="muted">
                      {item.action_by_user_name || "System"} | {formatDateTime(item.created_at)}
                    </p>
                    <p>{item.details || item.note || "No activity note."}</p>
                  </div>
                ))}
                {!selectedAdhesiveToken.activities?.length ? <p className="muted">No activity logged yet.</p> : null}
              </div>
            </div>
          ) : (
            <p className="muted">Open any adhesive token entry to see full detail and activity history.</p>
          )}
        </div>

        <div className="stack">
          <h3>Report snapshot</h3>
          <div className="mini-list">
            {(adhesiveTokenReports?.mason_wise || []).slice(0, 5).map((item) => (
              <div key={`mason-${item.mason_mobile}-${item.mason_name}`} className="timeline-item">
                <strong>{item.mason_name}</strong>
                <p className="muted">
                  {item.mason_mobile || "No mobile"} | {item.entries_count} entries
                </p>
                <p>Pending Rs {item.pending_amount} | Paid Rs {item.paid_amount}</p>
              </div>
            ))}
            {!adhesiveTokenReports?.mason_wise?.length ? <p className="muted">No mason-wise token report yet.</p> : null}
          </div>
          <div className="mini-list">
            {(adhesiveTokenReports?.company_wise || []).slice(0, 5).map((item) => (
              <div key={`company-${item.adhesive_company}`} className="timeline-item">
                <strong>{item.adhesive_company}</strong>
                <p className="muted">{item.entries_count} entries</p>
                <p>Pending Rs {item.pending_amount} | Paid Rs {item.paid_amount}</p>
              </div>
            ))}
            {!adhesiveTokenReports?.company_wise?.length ? <p className="muted">No company-wise token report yet.</p> : null}
          </div>
          <div className="mini-list">
            {(adhesiveTokenReports?.site_wise || []).slice(0, 5).map((item) => (
              <div key={`site-${item.site_name}`} className="timeline-item">
                <strong>{item.site_name}</strong>
                <p className="muted">{item.entries_count} entries</p>
                <p>Pending Rs {item.pending_amount} | Paid Rs {item.paid_amount}</p>
              </div>
            ))}
            {!adhesiveTokenReports?.site_wise?.length ? <p className="muted">No site-wise token report yet.</p> : null}
          </div>
          <div className="mini-list">
            {(adhesiveTokenReports?.monthly_payout || []).slice(0, 6).map((item) => (
              <div key={`month-${item.payout_month}`} className="timeline-item">
                <strong>{item.payout_month}</strong>
                <p className="muted">{item.entries_count} entries</p>
                <p>Pending Rs {item.pending_amount} | Paid Rs {item.paid_amount}</p>
              </div>
            ))}
            {!adhesiveTokenReports?.monthly_payout?.length ? <p className="muted">No monthly payout report yet.</p> : null}
          </div>
          <div className="mini-list">
            {(adhesiveTokenReports?.mismatch_rejected_claims || []).slice(0, 6).map((item) => (
              <div key={`mismatch-${item.id}`} className="timeline-item">
                <strong>
                  {item.site_name} | {item.invoice_number}
                </strong>
                <p className="muted">
                  {item.mason_name} | {item.adhesive_company}
                </p>
                <p>
                  {labelize(item.verification_status)} | Rs {item.total_token_amount}
                </p>
              </div>
            ))}
            {!adhesiveTokenReports?.mismatch_rejected_claims?.length ? <p className="muted">No mismatch or rejected claims yet.</p> : null}
          </div>
        </div>

        <div className="stack">
          <h3>Recent activity</h3>
          <div className="mini-list">
            {adhesiveTokenActivities.slice(0, 8).map((item) => (
              <div key={item.id} className="timeline-item">
                <strong>
                  {labelize(item.action)} | {item.mason_name}
                </strong>
                <p className="muted">
                  {item.site_name} | {item.action_by_user_name || "System"} | {formatDateTime(item.created_at)}
                </p>
                <p>{item.details || item.note || "No activity note."}</p>
              </div>
            ))}
            {!adhesiveTokenActivities.length ? <p className="muted">No adhesive token activity yet.</p> : null}
          </div>
        </div>
      </section>
    </section>
  );
}
