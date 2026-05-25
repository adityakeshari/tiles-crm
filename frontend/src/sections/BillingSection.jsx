import { useEffect, useMemo, useState } from "react";

const HIGH_DISCOUNT_PERCENT = 10;

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function displayInvoiceType(value) {
  return value === "estimate" ? "Estimate" : "Final Bill";
}

function getRateTierLabel(quantityValue) {
  const quantity = Number(quantityValue || 0);

  if (quantity >= 51) {
    return "Qty 51+ tier";
  }

  if (quantity >= 11) {
    return "Qty 11-50 tier";
  }

  return "Qty 1-10 tier";
}

function InvoiceCard({
  invoice,
  selected,
  onSelect,
  onEdit,
  onSubmitApproval,
  onApprove,
  onReject,
  onCancel,
  onDelete,
  onOpenPdf,
  onShare,
  canManageApproval,
  canDelete,
  formatDate,
  formatDateTime,
}) {
  return (
    <article className={`lead-card billing-card ${selected ? "active" : ""}`} onClick={onSelect}>
      <div className="section-head">
        <div>
          <h3>{invoice.customer_name || "Walk-in Customer"}</h3>
          <p className="muted">
            {invoice.invoice_number} | {formatDate(invoice.invoice_date)}
          </p>
        </div>
        <span className={`status-chip status-${invoice.status}`}>{invoice.approval_required ? "Approval required" : invoice.status.replaceAll("_", " ")}</span>
      </div>
      <p className="billing-card-line">
        {displayInvoiceType(invoice.invoice_type)} | {formatCurrency(invoice.grand_total)} | {invoice.payment_status.replaceAll("_", " ")}
      </p>
      <p className="billing-card-line">
        {invoice.customer_mobile || "No mobile"} {invoice.site_reference ? `| ${invoice.site_reference}` : ""}
      </p>
      <p className="muted billing-card-line">
        Created by {invoice.created_by_user_name || "System"} {invoice.created_at ? `| ${formatDateTime(invoice.created_at)}` : ""}
      </p>
      <div className="billing-actions billing-actions-primary">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          View Detail
        </button>
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
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onSubmitApproval();
          }}
        >
          Submit Approval
        </button>
      </div>
      <div className="billing-actions">
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPdf("gst_invoice");
          }}
        >
          Final Bill PDF
        </button>
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPdf("estimate");
          }}
        >
          Estimate PDF
        </button>
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onShare();
          }}
        >
          WhatsApp
        </button>
        {canManageApproval ? (
          <>
            <button
              type="button"
              className="secondary"
              onClick={(event) => {
                event.stopPropagation();
                onApprove();
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="secondary"
              onClick={(event) => {
                event.stopPropagation();
                onReject();
              }}
            >
              Reject
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </button>
        {canDelete ? (
          <button
            type="button"
            className="secondary danger-soft billing-delete-action"
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

function BillingEmptyDetail({ EmptyState }) {
  return (
    <EmptyState
      compact
      title="No bill selected"
      message="Select a bill to review rate approval, payment, print and customer action history."
    />
  );
}

export default function BillingSection(props) {
  const {
    billingSummary,
    billingReports,
    billingReferenceOptions,
    billingStatuses,
    billingPaymentStatuses,
    billingPaymentModes,
    invoiceForm,
    setInvoiceForm,
    invoiceFormErrors,
    setInvoiceFormErrors,
    editingInvoiceId,
    handleSaveBillingInvoice,
    handleCancelBillingEdit,
    addBillingInvoiceItem,
    removeBillingInvoiceItem,
    handleBillingInvoiceItemChange,
    handleBillingInventoryProductChange,
    handleBillingLeadReferenceChange,
    handleBillingQuotationReferenceChange,
    handleBillingProjectReferenceChange,
    getBillingTotals,
    computeBillingItemTotal,
    busyAction,
    filteredInvoices,
    invoices,
    ListLoadControls,
    listLimits,
    increaseListLimit,
    loading,
    billingSearch,
    setBillingSearch,
    billingStatusFilter,
    setBillingStatusFilter,
    billingPaymentFilter,
    setBillingPaymentFilter,
    billingFromFilter,
    setBillingFromFilter,
    billingToFilter,
    setBillingToFilter,
    selectedInvoice,
    handleOpenBillingInvoiceDetail,
    startEditingBillingInvoice,
    requestSubmitBillingInvoiceApproval,
    requestReviewBillingInvoice,
    requestCancelBillingInvoice,
    requestDeleteBillingInvoice,
    billingPaymentForm,
    setBillingPaymentForm,
    handleSaveBillingPayment,
    formatDate,
    formatDateTime,
    getBillingPdfUrl,
    shareOnWhatsApp,
    getCsvExportUrl,
    user,
    hasAnyRole,
    EmptyState,
    HighlightRow,
    BadgeCard,
    StatCard,
    clearFieldErrorFromEvent,
    getFieldErrorClass,
  } = props;

  const [activeTab, setActiveTab] = useState("create");
  const [discountPreview, setDiscountPreview] = useState(null);
  const totals = getBillingTotals(invoiceForm);
  const canManageApproval = hasAnyRole(user, ["admin", "manager"]);
  const canTakePayment = hasAnyRole(user, ["admin", "manager", "accounts", "operator"]);
  const invoiceList = filteredInvoices || [];
  const allInvoices = invoices || [];
  const customerMode = invoiceForm.lead_id ? "lead" : "walk_in";
  const receivedAmount = Number(billingPaymentForm.amount || 0);
  const balanceAmount = Number((totals.grand_total - receivedAmount).toFixed(2));

  useEffect(() => {
    if (!(invoiceForm.items || []).some((item) => Number(item?.gst_percent || 0) !== 0)) {
      return;
    }

    setInvoiceForm((current) => ({
      ...current,
      items: (current.items || []).map((item) => ({
        ...item,
        gst_percent: "0",
      })),
    }));
  }, [invoiceForm.items, setInvoiceForm]);

  const productMap = useMemo(
    () => new Map((billingReferenceOptions.products || []).map((product) => [String(product.id), product])),
    [billingReferenceOptions.products]
  );
  const billingDiscountSourceKey = useMemo(
    () =>
      JSON.stringify({
        lead_id: invoiceForm.lead_id || "",
        items: (invoiceForm.items || []).map((item) => ({
          product_id: item.product_id || "",
          quantity: item.quantity || "",
          rate: item.rate || "",
        })),
      }),
    [invoiceForm.lead_id, invoiceForm.items]
  );

  const selectedInvoiceShareMessage = selectedInvoice
    ? `Namaste ${selectedInvoice.customer_name || "Customer"}, your ${displayInvoiceType(selectedInvoice.invoice_type)} ${selectedInvoice.invoice_number} is ready for AIBA Tiles Agency. Total ${formatCurrency(selectedInvoice.grand_total)}.`
    : "";

  const approvalInvoices = useMemo(
    () => invoiceList.filter((invoice) => invoice.status === "pending_approval" || invoice.approval_required),
    [invoiceList]
  );

  const reportCards = useMemo(
    () => [
      { label: "Daily Billing", value: billingReports?.daily_billing?.length ?? 0 },
      { label: "Product-wise Sales", value: billingReports?.product_wise_sales?.length ?? 0 },
      { label: "Customer Ledger", value: billingReports?.customer_ledger?.length ?? 0 },
      { label: "Payment Report", value: billingReports?.payment_report?.length ?? 0 },
      { label: "Monthly Billing", value: billingReports?.billing_summary?.monthly_billing ?? 0 },
      { label: "Monthly Overhead", value: billingReports?.billing_summary?.monthly_overhead ?? 0 },
      { label: "Net Profit", value: billingReports?.billing_summary?.net_profit ?? 0 },
    ],
    [billingReports]
  );

  useEffect(() => {
    if (discountPreview && discountPreview.sourceKey !== billingDiscountSourceKey) {
      setDiscountPreview(null);
    }
  }, [billingDiscountSourceKey, discountPreview]);

  function getProductForItem(item) {
    return item?.product_id ? productMap.get(String(item.product_id)) || null : null;
  }

  function isTileItem(item) {
    const product = getProductForItem(item);
    const category = String(product?.category || item?.item_type || "").trim().toLowerCase();
    return category.includes("tile");
  }

  function getProductStrategy(product) {
    const normalizedStatus = String(product?.status || "").trim().toLowerCase();
    const suggestedRate = Number(product?.suggested_selling_rate || product?.price_per_sqft || 0);
    const realCost = Number(product?.real_cost_per_unit || product?.landed_cost_per_unit || 0);

    if (normalizedStatus === "dead_stock") {
      return "clearance";
    }

    if (normalizedStatus === "fast_moving") {
      return "fast_moving";
    }

    if (Number(product?.stock_sqft || 0) >= 1200) {
      return "slow_moving";
    }

    if (realCost > 0 && suggestedRate > realCost * 1.4) {
      return "premium";
    }

    return "normal";
  }

  function getStrategyConfig(strategy) {
    switch (strategy) {
      case "premium":
        return { floorRatio: 0.99, bufferUse: 0.14, label: "Premium tiles" };
      case "fast_moving":
        return { floorRatio: 0.97, bufferUse: 0.22, label: "Fast moving tiles" };
      case "slow_moving":
        return { floorRatio: 0.91, bufferUse: 0.62, label: "Slow moving stock" };
      case "clearance":
        return { floorRatio: 0.87, bufferUse: 0.8, label: "Clearance support" };
      default:
        return { floorRatio: 0.94, bufferUse: 0.38, label: "Standard tiles" };
    }
  }

  function distributeAmounts(totalAmount, entries) {
    if (!entries.length || totalAmount <= 0) {
      return [];
    }

    const roundedTotal = Number(totalAmount.toFixed(2));
    const totalWeight = entries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);

    if (totalWeight <= 0) {
      return entries.map((entry, index) => ({
        index,
        amount: index === 0 ? roundedTotal : 0,
      }));
    }

    const weighted = entries.map((entry) => ({
      index: entry.index,
      raw: (roundedTotal * Number(entry.weight || 0)) / totalWeight,
    }));
    let distributed = weighted.reduce((sum, entry) => sum + Number(entry.raw.toFixed(2)), 0);
    const difference = Number((roundedTotal - distributed).toFixed(2));

    if (difference !== 0) {
      const target = [...weighted].sort((left, right) => right.raw - left.raw)[0];
      target.raw += difference;
      distributed = weighted.reduce((sum, entry) => sum + Number(entry.raw.toFixed(2)), 0);
    }

    return weighted.map((entry) => ({
      index: entry.index,
      amount: Number(entry.raw.toFixed(2)),
    }));
  }

  function getSuggestedRate(item) {
    const product = getProductForItem(item);
    const explicitSuggestedRate = Number(item?.suggested_rate || 0);

    if (explicitSuggestedRate > 0) {
      return explicitSuggestedRate;
    }

    const productRate = Number(product?.suggested_selling_rate || product?.price_per_sqft || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0);
    return productRate > 0 ? productRate : 0;
  }

  function getMinimumRate(item) {
    const explicitMinimumRate = Number(item?.minimum_allowed_rate || 0);

    if (explicitMinimumRate > 0) {
      return explicitMinimumRate;
    }

    const product = getProductForItem(item);
    return Number(product?.minimum_allowed_rate || product?.real_cost_per_unit || getSuggestedRate(item) || 0);
  }

  function getOverheadCostRate(item) {
    const product = getProductForItem(item);
    return Number(product?.overhead_cost_per_unit || 0);
  }

  function getFinalBusinessCostRate(item) {
    const product = getProductForItem(item);
    return Number(product?.final_business_cost_per_unit || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0);
  }

  function getCustomerRate(item) {
    return Number(item?.customer_rate ?? item?.rate ?? 0);
  }

  function getItemApprovalMeta(item) {
    const suggestedRate = getSuggestedRate(item);
    const minimumRate = getMinimumRate(item);
    const realCostRate = Number(getProductForItem(item)?.real_cost_per_unit || 0);
    const overheadCostRate = getOverheadCostRate(item);
    const finalBusinessCostRate = getFinalBusinessCostRate(item);
    const customerRate = getCustomerRate(item);
    const quantity = Number(item?.quantity || 0);
    const lineTotal = Number(item?.total || 0);
    const reasons = [];
    const hardLoss = realCostRate > 0 && customerRate > 0 && customerRate < realCostRate;
    const businessLoss = finalBusinessCostRate > 0 && customerRate > 0 && customerRate < finalBusinessCostRate;
    const estimatedProfit = lineTotal - finalBusinessCostRate * quantity;
    const lowProfit = !businessLoss && lineTotal > 0 && estimatedProfit / lineTotal <= 0.05;

    if (hardLoss) {
      reasons.push("Hard loss warning");
    }

    if (minimumRate > 0 && customerRate > 0 && customerRate < minimumRate) {
      reasons.push("Below minimum rate");
    }

    const baseAmount = quantity * customerRate;
    const discountPercent = baseAmount > 0 ? (Number(item?.discount || 0) / baseAmount) * 100 : 0;

    if (Number(discountPercent) > HIGH_DISCOUNT_PERCENT) {
      reasons.push("High discount");
    }

    if (!reasons.length && suggestedRate > 0 && customerRate !== suggestedRate) {
      reasons.push("Manual rate override");
    }

    return {
      requiresApproval: reasons.length > 0,
      reasons,
      suggestedRate,
      minimumRate,
      realCostRate,
      overheadCostRate,
      finalBusinessCostRate,
      hardLoss,
      businessLoss,
      estimatedProfit,
      lowProfit,
      customerRate,
      tierLabel: getRateTierLabel(item?.quantity),
    };
  }

  function buildSystemDiscountPreview() {
    const currentDiscountTotal = Number(
      (invoiceForm.items || []).reduce((sum, item) => sum + Number(item.discount || 0), 0).toFixed(2)
    );
    const baseGrandTotal = Number((totals.grand_total + currentDiscountTotal).toFixed(2));
    const tileEntries = (invoiceForm.items || [])
      .map((item, index) => ({ item, index, product: getProductForItem(item) }))
      .filter(({ item, product }) => item.product_id && product && isTileItem(item));

    if (!tileEntries.length) {
      return {
        sourceKey: billingDiscountSourceKey,
        applied: false,
        canApply: false,
        systemBenefitAmount: 0,
        originalTotal: baseGrandTotal,
        finalPayable: baseGrandTotal,
        approvalLevel: "auto",
        approvalNeeded: false,
        reason: "No tiles in this bill. System discount works only on tile items.",
        entries: [],
      };
    }

    const totalTileQuantity = tileEntries.reduce((sum, entry) => sum + Number(entry.item.quantity || 0), 0);
    const totalTileValue = tileEntries.reduce((sum, entry) => sum + Number(entry.item.quantity || 0) * Number(entry.item.rate || 0), 0);
    const uniqueTileProducts = new Set(tileEntries.map(({ item }) => String(item.product_id))).size;
    const leadCustomerBoost = invoiceForm.lead_id ? 0.04 : 0;

    const entrySummaries = tileEntries.map(({ item, index, product }) => {
      const quantity = Number(item.quantity || 0);
      const currentRate = Number(item.rate || 0);
      const suggestedRate = getSuggestedRate(item);
      const minimumRate = getMinimumRate(item);
      const realCostRate = Number(product?.real_cost_per_unit || 0);
      const strategy = getProductStrategy(product);
      const config = getStrategyConfig(strategy);
      const protectedFloor = Math.max(
        minimumRate,
        realCostRate,
        suggestedRate > 0 ? suggestedRate * config.floorRatio : 0
      );
      const marginBufferPerUnit = Math.max(currentRate - protectedFloor, 0);
      const slowStockBoost = strategy === "slow_moving" || strategy === "clearance" ? 0.16 : 0;
      const quantityBoost = totalTileQuantity >= 80 ? 0.14 : totalTileQuantity >= 40 ? 0.08 : totalTileQuantity >= 20 ? 0.04 : 0;
      const valueBoost = totalTileValue >= 150000 ? 0.12 : totalTileValue >= 80000 ? 0.08 : totalTileValue >= 30000 ? 0.04 : 0;
      const mixBoost = uniqueTileProducts >= 4 ? 0.07 : uniqueTileProducts >= 2 ? 0.03 : 0;
      const multiplier = Math.min(config.bufferUse + slowStockBoost + quantityBoost + valueBoost + mixBoost + leadCustomerBoost, 0.88);
      const recommendedPerUnit = Math.min(marginBufferPerUnit * multiplier, marginBufferPerUnit);
      const recommendedAmount = Number((recommendedPerUnit * quantity).toFixed(2));

      return {
        index,
        quantity,
        currentRate,
        suggestedRate,
        minimumRate,
        realCostRate,
        strategy,
        strategyLabel: config.label,
        protectedFloor,
        marginBufferPerUnit,
        recommendedAmount,
        weight: recommendedAmount > 0 ? recommendedAmount : quantity * Math.max(currentRate, 1),
      };
    });

    const systemBenefitAmount = Number(
      entrySummaries.reduce((sum, entry) => sum + entry.recommendedAmount, 0).toFixed(2)
    );
    const benefitAgainstTileValue = totalTileValue > 0 ? (systemBenefitAmount / totalTileValue) * 100 : 0;
    const approvalLevel =
      benefitAgainstTileValue > 5.5
        ? "owner"
        : benefitAgainstTileValue > 2.5
          ? "manager"
          : "auto";
    const reasonParts = [];

    if (totalTileQuantity >= 20) {
      reasonParts.push("volume support");
    }
    if (uniqueTileProducts >= 2) {
      reasonParts.push("product mix");
    }
    if (entrySummaries.some((entry) => entry.strategy === "slow_moving" || entry.strategy === "clearance")) {
      reasonParts.push("slow-moving stock push");
    }
    if (invoiceForm.lead_id) {
      reasonParts.push("existing customer");
    }
    if (!reasonParts.length) {
      reasonParts.push("protected margin benefit");
    }

    const entries = distributeAmounts(systemBenefitAmount, entrySummaries).map((distribution) => ({
      ...entrySummaries.find((entry) => entry.index === distribution.index),
      appliedDiscount: distribution.amount,
    }));
    const finalPayable = Number((baseGrandTotal - systemBenefitAmount).toFixed(2));

    return {
      sourceKey: billingDiscountSourceKey,
      applied: false,
      canApply: systemBenefitAmount > 0,
      originalTotal: baseGrandTotal,
      systemBenefitAmount,
      finalPayable,
      approvalLevel,
      approvalNeeded: approvalLevel !== "auto",
      reason: reasonParts.join(" + "),
      entries,
    };
  }

  function applySystemDiscount(preview, submitForApproval = false) {
    if (!preview?.canApply) {
      return;
    }

    const approvalLabel =
      preview.approvalLevel === "owner"
        ? "Owner approval"
        : preview.approvalLevel === "manager"
          ? "Manager approval"
          : "Auto approved";
    const auditNote = [
      "[System Discount]",
      `Original Total: ${totals.grand_total.toFixed(2)}`,
      `System Benefit: ${preview.systemBenefitAmount.toFixed(2)}`,
      `Final Total: ${preview.finalPayable.toFixed(2)}`,
      `Approval Level: ${approvalLabel}`,
      `Reason: ${preview.reason}`,
    ].join(" | ");
    const discountMap = new Map(preview.entries.map((entry) => [entry.index, entry.appliedDiscount]));

    setInvoiceForm((current) => ({
      ...current,
      approval_note: auditNote,
      system_discount_meta: {
        original_total: preview.originalTotal,
        system_benefit_amount: preview.systemBenefitAmount,
        final_total: preview.finalPayable,
        approval_level: preview.approvalLevel,
        reason: preview.reason,
      },
      status: submitForApproval || preview.approvalNeeded ? "pending_approval" : current.status || "draft",
      items: (current.items || []).map((item, index) => ({
        ...item,
        discount: discountMap.has(index) ? String(discountMap.get(index)) : "",
      })),
    }));

    setDiscountPreview({
      ...preview,
      applied: true,
      submitForApproval: submitForApproval || preview.approvalNeeded,
    });
  }

  async function handleBillingSaleSubmit(event) {
    const submitAction = event.nativeEvent?.submitter?.value || "draft";
    const detail = await handleSaveBillingInvoice(event);

    if (!detail?.id) {
      return;
    }

    let latestInvoice = detail;

    if (receivedAmount > 0) {
      const paymentDetail = await handleSaveBillingPayment(
        {
          preventDefault() {},
          currentTarget: null,
        },
        detail
      );

      if (paymentDetail?.id) {
        latestInvoice = paymentDetail;
      }
    }

    if (submitAction === "print") {
      window.open(getBillingPdfUrl(latestInvoice.id, "gst_invoice"), "_blank", "noopener,noreferrer");
      return;
    }

    if (submitAction === "whatsapp") {
      shareOnWhatsApp(
        latestInvoice.customer_mobile,
        `Namaste ${latestInvoice.customer_name || "Customer"}, your ${displayInvoiceType(latestInvoice.invoice_type)} ${latestInvoice.invoice_number} is ready for AIBA Tiles Agency. Total ${formatCurrency(latestInvoice.grand_total)}.`
      );
    }
  }

  function renderSelectedInvoiceDetail() {
    if (!selectedInvoice) {
      return <BillingEmptyDetail EmptyState={EmptyState} />;
    }

    return (
      <div className="detail-card stack">
        <div className="section-head">
          <div>
            <strong>{selectedInvoice.customer_name || "Walk-in Customer"}</strong>
            <p className="muted">
              {selectedInvoice.invoice_number} | {displayInvoiceType(selectedInvoice.invoice_type)}
            </p>
          </div>
          <span className={`status-chip status-${selectedInvoice.status}`}>{selectedInvoice.approval_required ? "Approval required" : selectedInvoice.status.replaceAll("_", " ")}</span>
        </div>
        <div className="lead-actions">
          <button type="button" className="secondary" onClick={() => handleOpenBillingInvoiceDetail(selectedInvoice.id)}>
            Refresh Detail
          </button>
          <button type="button" className="secondary" onClick={() => window.open(getBillingPdfUrl(selectedInvoice.id, "gst_invoice"), "_blank", "noopener,noreferrer")}>
            Final Bill PDF
          </button>
          <button type="button" className="secondary" onClick={() => window.open(getBillingPdfUrl(selectedInvoice.id, "estimate"), "_blank", "noopener,noreferrer")}>
            Estimate PDF
          </button>
          <button type="button" className="secondary" onClick={() => shareOnWhatsApp(selectedInvoice.customer_mobile, selectedInvoiceShareMessage)}>
            WhatsApp Share
          </button>
        </div>
        <div className="billing-detail-grid">
          <HighlightRow label="Customer" value={selectedInvoice.customer_name || "Walk-in Customer"} />
          <HighlightRow label="Mobile" value={selectedInvoice.customer_mobile || "Not shared"} />
          <HighlightRow label="Address" value={selectedInvoice.customer_address || "No address"} />
          <HighlightRow label="Site" value={selectedInvoice.site_reference || "No site reference"} />
          <HighlightRow label="Lead Ref" value={selectedInvoice.lead_name || "No lead linked"} />
          <HighlightRow label="Project Ref" value={selectedInvoice.project_name || "No project linked"} />
          <HighlightRow label="Invoice Date" value={formatDate(selectedInvoice.invoice_date)} />
          <HighlightRow label="Payment Status" value={selectedInvoice.payment_status.replaceAll("_", " ")} />
          <HighlightRow label="Received" value={formatCurrency(selectedInvoice.received_amount || 0)} />
          <HighlightRow label="Remaining" value={formatCurrency(selectedInvoice.remaining_amount || 0)} tone={Number(selectedInvoice.remaining_amount || 0) > 0 ? "danger" : "default"} />
          <HighlightRow label="Approval note" value={selectedInvoice.approval_note || selectedInvoice.approval_reason || "Not added"} />
          <HighlightRow label="Grand Total" value={formatCurrency(selectedInvoice.grand_total || 0)} tone="accent" />
        </div>

        <div className="mini-list">
          <h4>Invoice items</h4>
          {(selectedInvoice.items || []).map((item) => {
            const approvalMeta = getItemApprovalMeta(item);
            return (
              <div key={item.id} className="timeline-item">
                <strong>{item.product_name}</strong>
                <p className="muted">
                  {item.quantity} {item.unit} | Rate {formatCurrency(item.rate)} | Total {formatCurrency(item.total)}
                </p>
                {approvalMeta.hardLoss ? <p className="field-error-message">Hard loss warning: customer rate is below real cost.</p> : null}
                {approvalMeta.businessLoss ? <p className="field-error-message">Loss warning: customer rate is below final business cost.</p> : null}
              </div>
            );
          })}
          {!selectedInvoice.items?.length ? <p className="muted">Open bill detail to view line items.</p> : null}
        </div>

        {canTakePayment && selectedInvoice.status !== "cancelled" ? (
          <form className="form-grid" onSubmit={handleSaveBillingPayment}>
            <input
              type="number"
              min="0"
              placeholder="Received amount"
              value={billingPaymentForm.amount}
              onChange={(event) => setBillingPaymentForm({ ...billingPaymentForm, amount: event.target.value })}
            />
            <select value={billingPaymentForm.payment_mode} onChange={(event) => setBillingPaymentForm({ ...billingPaymentForm, payment_mode: event.target.value })}>
              {billingPaymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            <textarea
              className="full-span"
              placeholder="Payment note"
              value={billingPaymentForm.note}
              onChange={(event) => setBillingPaymentForm({ ...billingPaymentForm, note: event.target.value })}
            />
            <button type="submit" className="full-span" disabled={busyAction === "save-billing-payment"}>
              {busyAction === "save-billing-payment" ? "Recording Payment..." : "Record Payment"}
            </button>
          </form>
        ) : null}

        <div className="mini-list">
          <h4>Payments</h4>
          {(selectedInvoice.payments || []).map((payment) => (
            <div key={payment.id} className="timeline-item">
              <strong>{formatCurrency(payment.amount)}</strong>
              <p className="muted">
                {payment.payment_mode.replaceAll("_", " ")} | {payment.received_by_name || "System"} | {formatDateTime(payment.received_at)}
              </p>
              <p>{payment.note || "No note added."}</p>
            </div>
          ))}
          {!selectedInvoice.payments?.length ? <p className="muted">No payments recorded yet.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <section className="stack billing-workspace">
      <section className="panel billing-summary-panel">
        <div className="section-head">
          <h2>Billing</h2>
          <span>{activeTab === "create" ? "Fast billing for walk-ins and existing leads." : "Approval, ledger and reporting stay in their own workspace tabs."}</span>
        </div>
        {activeTab !== "create" ? (
          <div className="report-grid billing-summary-grid">
            <BadgeCard title="Today Billing" count={formatCurrency(billingSummary?.today_billing || 0)} tone="accent" />
            <BadgeCard title="Total Bills" count={billingSummary?.total_bills ?? 0} />
            <BadgeCard title="Paid Bills" count={billingSummary?.paid_bills ?? 0} tone="accent" />
            <BadgeCard title="Pending Bills" count={billingSummary?.pending_bills ?? 0} />
            <BadgeCard title="Monthly Billing" count={formatCurrency(billingSummary?.monthly_billing || 0)} />
            <BadgeCard title="Today's Collection" count={formatCurrency(billingSummary?.todays_collection || 0)} />
          </div>
        ) : null}
        <div className="module-nav billing-tab-nav">
          <button type="button" className={`module-link ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
            New Sale
          </button>
          <button type="button" className={`module-link ${activeTab === "ledger" ? "active" : ""}`} onClick={() => setActiveTab("ledger")}>
            Sales Ledger
          </button>
          <button type="button" className={`module-link ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
            Reports
          </button>
          <button type="button" className={`module-link ${activeTab === "approval" ? "active" : ""}`} onClick={() => setActiveTab("approval")}>
            Approval Queue
          </button>
        </div>
      </section>

      {activeTab === "create" ? (
        <section className="stack">
          <section className="panel billing-entry-shell">
            <div className="section-head">
              <h2>{editingInvoiceId ? "Edit Sale" : "New Sale"}</h2>
              <span>Simple, fast billing screen for showroom operators.</span>
            </div>

            <form
              className="billing-entry-form"
              onSubmit={handleBillingSaleSubmit}
              onInputCapture={(event) => clearFieldErrorFromEvent(event, setInvoiceFormErrors)}
              onChangeCapture={(event) => clearFieldErrorFromEvent(event, setInvoiceFormErrors)}
            >
              <section className="detail-card billing-sale-section">
                <div className="section-head">
                  <h3>Customer</h3>
                  <span>{customerMode === "lead" ? "Existing lead selected" : "Walk-in billing"}</span>
                </div>
                <div className="billing-sale-top-grid">
                  <div className="form-field">
                    <label>Walk-in / Existing Lead</label>
                    <select
                      value={customerMode}
                      onChange={(event) => {
                        if (event.target.value === "walk_in") {
                          handleBillingLeadReferenceChange("");
                          setInvoiceForm((current) => ({
                            ...current,
                            quotation_id: "",
                            project_id: "",
                          }));
                        }
                      }}
                    >
                      <option value="walk_in">Walk-in Customer</option>
                      <option value="lead">Existing Lead</option>
                    </select>
                  </div>
                  {customerMode === "lead" ? (
                    <div className="form-field">
                      <label>Existing Lead</label>
                      <select value={invoiceForm.lead_id} onChange={(event) => handleBillingLeadReferenceChange(event.target.value)}>
                        <option value="">Select lead</option>
                        {(billingReferenceOptions.leads || []).map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.name} | {lead.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="form-field">
                    <label>
                      Customer Name <span className="required-marker">*</span>
                    </label>
                    <input
                      data-field="customer_name"
                      className={getFieldErrorClass(invoiceFormErrors, "customer_name")}
                      placeholder="Customer Name"
                      value={invoiceForm.customer_name}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, customer_name: event.target.value })}
                    />
                    {invoiceFormErrors?.customer_name ? <span className="field-error-message">{invoiceFormErrors.customer_name}</span> : null}
                  </div>
                  <div className="form-field">
                    <label>Mobile</label>
                    <input
                      placeholder="Mobile"
                      value={invoiceForm.customer_mobile}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, customer_mobile: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Address</label>
                    <input
                      placeholder="Address"
                      value={invoiceForm.customer_address}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, customer_address: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Site (optional)</label>
                    <input
                      placeholder="Site"
                      value={invoiceForm.site_reference}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, site_reference: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Bill No</label>
                    <input readOnly value={editingInvoiceId ? selectedInvoice?.invoice_number || "Existing bill" : "Auto on save"} />
                  </div>
                  <div className="form-field">
                    <label>
                      Date <span className="required-marker">*</span>
                    </label>
                    <input
                      data-field="invoice_date"
                      className={getFieldErrorClass(invoiceFormErrors, "invoice_date")}
                      type="date"
                      value={invoiceForm.invoice_date}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })}
                    />
                    {invoiceFormErrors?.invoice_date ? <span className="field-error-message">{invoiceFormErrors.invoice_date}</span> : null}
                  </div>
                </div>
              </section>

              <div className="detail-card stack full-span">
                <div className="section-head">
                  <h3>Products</h3>
                  <button type="button" className="secondary" onClick={addBillingInvoiceItem}>
                    + Add Product
                  </button>
                </div>
                <div className="billing-sale-table-wrap">
                  <div className="billing-sale-table billing-sale-table-head">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Rate</span>
                    <span>Amount</span>
                    <span>Action</span>
                  </div>
                  {(invoiceForm.items || []).map((item, index) => {
                    const approvalMeta = getItemApprovalMeta(item);
                    const product = getProductForItem(item);
                    const amount = Number((Number(item.quantity || 0) * Number(item.rate || 0)).toFixed(2));

                    return (
                      <div key={`invoice-item-${index}`} className="timeline-item billing-item-shell billing-sale-row">
                        <div className="billing-sale-table">
                          <div className="form-field">
                            <select
                              data-field={`items.${index}.product_id`}
                              className={getFieldErrorClass(invoiceFormErrors, `items.${index}.product_id`)}
                              value={item.product_id}
                              onChange={(event) => handleBillingInventoryProductChange(index, event.target.value)}
                            >
                              <option value="">Select Product *</option>
                              {(billingReferenceOptions.products || []).map((productOption) => (
                                <option key={productOption.id} value={productOption.id}>
                                  {productOption.name} | {productOption.business_unit}
                                </option>
                              ))}
                            </select>
                            {invoiceFormErrors?.[`items.${index}.product_id`] ? <span className="field-error-message">{invoiceFormErrors[`items.${index}.product_id`]}</span> : null}
                            <div className="billing-sale-meta">
                              <span>{product?.company_name || "Company not set"}</span>
                              <span>{product?.product_size || product?.tile_size || "Size not set"}</span>
                              <span>{product?.category || "Category not set"}</span>
                              <span>{product?.unit || item.unit || "Unit not set"}</span>
                              <span>Last rate {product?.last_purchase_rate ? formatCurrency(product.last_purchase_rate) : "N/A"}</span>
                            </div>
                          </div>
                          <div className="form-field">
                            <input
                              data-field={`items.${index}.quantity`}
                              className={getFieldErrorClass(invoiceFormErrors, `items.${index}.quantity`)}
                              type="number"
                              min="0"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(event) => handleBillingInvoiceItemChange(index, "quantity", event.target.value)}
                            />
                            {invoiceFormErrors?.[`items.${index}.quantity`] ? <span className="field-error-message">{invoiceFormErrors[`items.${index}.quantity`]}</span> : null}
                          </div>
                          <div className="form-field">
                            <input
                              data-field={`items.${index}.rate`}
                              className={getFieldErrorClass(invoiceFormErrors, `items.${index}.rate`)}
                              type="number"
                              min="0"
                              placeholder="Rate"
                              value={item.rate}
                              onChange={(event) => handleBillingInvoiceItemChange(index, "rate", event.target.value)}
                            />
                            {invoiceFormErrors?.[`items.${index}.rate`] ? <span className="field-error-message">{invoiceFormErrors[`items.${index}.rate`]}</span> : null}
                          </div>
                          <div className="mini-card billing-rate-card compact">
                            <strong>{formatCurrency(amount)}</strong>
                            <span>{approvalMeta.suggestedRate > 0 ? `Auto ${formatCurrency(approvalMeta.suggestedRate)}` : "Manual rate"}</span>
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => removeBillingInvoiceItem(index)}
                            disabled={(invoiceForm.items || []).length === 1}
                          >
                            Remove
                          </button>
                        </div>
                        {approvalMeta.businessLoss || approvalMeta.lowProfit ? (
                          <div className="billing-item-meta">
                            <span className={`status-chip ${approvalMeta.businessLoss ? "status-rejected" : "status-pending_approval"}`}>
                              {approvalMeta.businessLoss ? "Loss warning" : "Low profit warning"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <section className="panel billing-sale-sticky-summary">
                <div className="billing-sale-summary-grid">
                  <HighlightRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                  <div className="form-field">
                    <label>Transport</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Transport"
                      value={invoiceForm.transport_charge}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, transport_charge: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Other charges</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Other charges"
                      value={invoiceForm.additional_charge}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, additional_charge: event.target.value })}
                    />
                  </div>
                  <HighlightRow label="Grand Total" value={formatCurrency(totals.grand_total)} tone="accent" />
                  <div className="form-field">
                    <label>Received Amount</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Received amount"
                      value={billingPaymentForm.amount}
                      onChange={(event) => setBillingPaymentForm({ ...billingPaymentForm, amount: event.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Payment Mode</label>
                    <select value={billingPaymentForm.payment_mode} onChange={(event) => setBillingPaymentForm({ ...billingPaymentForm, payment_mode: event.target.value })}>
                      {billingPaymentModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <HighlightRow label="Balance" value={formatCurrency(balanceAmount)} tone={balanceAmount > 0 ? "danger" : "default"} />
                  <div className="form-field billing-sale-summary-note">
                    <label>Remarks</label>
                    <input
                      placeholder="Remarks"
                      value={invoiceForm.notes}
                      onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })}
                    />
                  </div>
                </div>

                <div className="billing-discount-bar">
                  <button type="button" className="secondary" onClick={() => setDiscountPreview(buildSystemDiscountPreview())}>
                    Calculate Discount
                  </button>
                  {invoiceForm.system_discount_meta?.system_benefit_amount ? (
                    <span className="muted">Applied benefit {formatCurrency(invoiceForm.system_discount_meta.system_benefit_amount)}</span>
                  ) : (
                    <span className="muted">Bill saves at normal rate unless system discount is applied.</span>
                  )}
                </div>

                {discountPreview ? (
                  <div className="billing-discount-preview">
                    <div className="section-head">
                      <div>
                        <h3>System Discount</h3>
                        <span>{discountPreview.reason}</span>
                      </div>
                      <span className={`status-chip ${discountPreview.approvalNeeded ? "status-pending_approval" : "status-approved"}`}>
                        {discountPreview.approvalLevel === "owner"
                          ? "Owner approval"
                          : discountPreview.approvalLevel === "manager"
                            ? "Ayush approval"
                            : "Auto approved"}
                      </span>
                    </div>

                    {discountPreview.canApply ? (
                      <>
                        <div className="billing-discount-grid">
                          <HighlightRow label="System Benefit Amount" value={formatCurrency(discountPreview.systemBenefitAmount)} tone="accent" />
                          <HighlightRow label="Final Payable" value={formatCurrency(discountPreview.finalPayable)} />
                          <HighlightRow label="Reason" value={discountPreview.reason} />
                          <HighlightRow
                            label="Approval Level"
                            value={
                              discountPreview.approvalLevel === "owner"
                                ? "Owner approval"
                                : discountPreview.approvalLevel === "manager"
                                  ? "Ayush approval"
                                  : "Auto approved"
                            }
                          />
                        </div>
                        <div className="billing-discount-actions">
                          <button type="button" onClick={() => applySystemDiscount(discountPreview, false)}>
                            Apply System Discount
                          </button>
                          <button type="button" className="secondary" onClick={() => setDiscountPreview(null)}>
                            Cancel
                          </button>
                          {discountPreview.approvalNeeded ? (
                            <button type="button" className="secondary" onClick={() => applySystemDiscount(discountPreview, true)}>
                              Send for Approval
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="muted">{discountPreview.reason}</p>
                    )}
                  </div>
                ) : null}

                <div className="lead-actions billing-sale-actions">
                  <button type="submit" name="saleAction" value="draft" disabled={busyAction === "save-billing-invoice" || busyAction === "save-billing-payment"}>
                    {busyAction === "save-billing-invoice" ? (editingInvoiceId ? "Updating..." : "Saving...") : "Save Draft"}
                  </button>
                  <button type="submit" name="saleAction" value="print" className="secondary" disabled={busyAction === "save-billing-invoice" || busyAction === "save-billing-payment"}>
                    Save &amp; Print
                  </button>
                  <button type="submit" name="saleAction" value="whatsapp" className="secondary" disabled={busyAction === "save-billing-invoice" || busyAction === "save-billing-payment"}>
                    Save &amp; WhatsApp
                  </button>
                  {editingInvoiceId ? (
                    <button type="button" className="secondary" onClick={handleCancelBillingEdit}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </section>
            </form>
          </section>
        </section>
      ) : null}

      {activeTab === "ledger" ? (
        <section className="stack">
          <section className="panel">
            <div className="section-head">
              <h2>Sales ledger</h2>
              <span>{invoiceList.length} bills</span>
            </div>

            <div className="lead-actions">
              <button type="button" className="secondary" onClick={() => window.open(getCsvExportUrl("billing"), "_blank", "noopener,noreferrer")}>
                Export Billing CSV
              </button>
              <button type="button" className="secondary" onClick={() => window.open(getCsvExportUrl("billing-customer-ledger"), "_blank", "noopener,noreferrer")}>
                Export Customer Ledger
              </button>
            </div>

            <div className="form-grid">
              <input placeholder="Search customer / mobile / invoice" value={billingSearch} onChange={(event) => setBillingSearch(event.target.value)} />
              <select value={billingStatusFilter} onChange={(event) => setBillingStatusFilter(event.target.value)}>
                <option value="all">All billing statuses</option>
                {billingStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={billingPaymentFilter} onChange={(event) => setBillingPaymentFilter(event.target.value)}>
                <option value="all">All payment statuses</option>
                {billingPaymentStatuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input type="date" value={billingFromFilter} onChange={(event) => setBillingFromFilter(event.target.value)} />
              <input type="date" value={billingToFilter} onChange={(event) => setBillingToFilter(event.target.value)} />
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setBillingSearch("");
                  setBillingStatusFilter("all");
                  setBillingPaymentFilter("all");
                  setBillingFromFilter("");
                  setBillingToFilter("");
                }}
              >
                Clear Filters
              </button>
            </div>

            <ListLoadControls count={allInvoices.length} limit={listLimits.invoices} onLoadMore={() => increaseListLimit("invoices")} disabled={loading} />

            <div className="list">
              {invoiceList.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  selected={selectedInvoice?.id === invoice.id}
                  onSelect={() => handleOpenBillingInvoiceDetail(invoice.id)}
                  onEdit={() => startEditingBillingInvoice(invoice)}
                  onSubmitApproval={() => requestSubmitBillingInvoiceApproval(invoice)}
                  onApprove={() => requestReviewBillingInvoice(invoice, "approved")}
                  onReject={() => requestReviewBillingInvoice(invoice, "rejected")}
                  onCancel={() => requestCancelBillingInvoice(invoice)}
                  onDelete={() => requestDeleteBillingInvoice(invoice)}
                  onOpenPdf={(type) => window.open(getBillingPdfUrl(invoice.id, type), "_blank", "noopener,noreferrer")}
                  onShare={() =>
                    shareOnWhatsApp(
                      invoice.customer_mobile,
                      `Namaste ${invoice.customer_name || "Customer"}, your ${displayInvoiceType(invoice.invoice_type)} ${invoice.invoice_number} from AIBA Tiles Agency is ready. Total ${formatCurrency(invoice.grand_total)}.`
                    )
                  }
                  canManageApproval={canManageApproval}
                  canDelete={hasAnyRole(user, ["admin"])}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
                />
              ))}
              {filteredInvoices.length === 0 ? (
                <EmptyState title="No bills yet" message="Create a showroom bill for a walk-in customer or optionally link it with a lead, quotation, or project." />
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Selected bill</h2>
              <span>Print, share, payment and approval history</span>
            </div>
            {renderSelectedInvoiceDetail()}
          </section>
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="stack">
          <section className="panel">
            <div className="section-head">
              <h2>Billing reports</h2>
              <span>Daily billing, product sales, customer ledger, payments and monthly view</span>
            </div>
            <div className="report-grid billing-summary-grid">
              {reportCards.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} />
              ))}
            </div>
          </section>

          <section className="content-grid">
            <section className="panel">
              <div className="section-head">
                <h2>Daily billing</h2>
                <span>{billingReports?.daily_billing?.length ?? 0} days</span>
              </div>
              <div className="mini-list">
                {(billingReports?.daily_billing || []).slice(0, 10).map((item) => (
                  <div key={`${item.report_date}`} className="timeline-item">
                    <strong>{formatDate(item.report_date)}</strong>
                    <p className="muted">{item.bill_count} bills</p>
                    <p>Total {formatCurrency(item.total_amount)} | Collection {formatCurrency(item.received_amount)}</p>
                  </div>
                ))}
                {!billingReports?.daily_billing?.length ? <p className="muted">No daily billing report yet.</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <h2>Product-wise sales</h2>
                <span>{billingReports?.product_wise_sales?.length ?? 0} items</span>
              </div>
              <div className="mini-list">
                {(billingReports?.product_wise_sales || []).slice(0, 10).map((item) => (
                  <div key={`${item.product_name}-${item.item_type}`} className="timeline-item">
                    <strong>{item.product_name}</strong>
                    <p className="muted">{item.item_type.replaceAll("_", " ")} | Qty {item.total_quantity}</p>
                    <p>Sales {formatCurrency(item.total_sales)}</p>
                  </div>
                ))}
                {!billingReports?.product_wise_sales?.length ? <p className="muted">No product-wise sales yet.</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <h2>Customer ledger</h2>
                <span>{billingReports?.customer_ledger?.length ?? 0} customers</span>
              </div>
              <div className="mini-list">
                {(billingReports?.customer_ledger || []).slice(0, 10).map((item) => (
                  <div key={`${item.customer_name}-${item.customer_mobile}`} className="timeline-item">
                    <strong>{item.customer_name || "Walk-in Customer"}</strong>
                    <p className="muted">{item.customer_mobile || "No mobile"} | {item.bill_count} bills</p>
                    <p>Billed {formatCurrency(item.billed_amount)} | Pending {formatCurrency(item.pending_amount)}</p>
                  </div>
                ))}
                {!billingReports?.customer_ledger?.length ? <p className="muted">No customer ledger yet.</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <h2>Payment & monthly summary</h2>
                <span>Compact collection snapshot</span>
              </div>
              <div className="mini-list">
                <div className="timeline-item">
                  <strong>Monthly billing</strong>
                  <p>{formatCurrency(billingReports?.billing_summary?.monthly_billing || 0)}</p>
                </div>
                <div className="timeline-item">
                  <strong>Today's collection</strong>
                  <p>{formatCurrency(billingReports?.billing_summary?.todays_collection || 0)}</p>
                </div>
              </div>
              <div className="mini-list">
                {(billingReports?.payment_report || []).slice(0, 8).map((item) => (
                  <div key={`${item.invoice_number}`} className="timeline-item">
                    <strong>{item.invoice_number}</strong>
                    <p className="muted">{item.customer_name || "Walk-in Customer"} | {item.payment_status.replaceAll("_", " ")}</p>
                    <p>Received {formatCurrency(item.received_amount)} | Remaining {formatCurrency(item.remaining_amount)}</p>
                  </div>
                ))}
                {!billingReports?.payment_report?.length ? <p className="muted">No payment report yet.</p> : null}
              </div>
            </section>
          </section>
        </section>
      ) : null}

      {activeTab === "approval" ? (
        <section className="stack">
          <section className="panel">
            <div className="section-head">
              <h2>Approval queue</h2>
              <span>{approvalInvoices.length} bills waiting for review</span>
            </div>
            <div className="list">
              {approvalInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  selected={selectedInvoice?.id === invoice.id}
                  onSelect={() => handleOpenBillingInvoiceDetail(invoice.id)}
                  onEdit={() => startEditingBillingInvoice(invoice)}
                  onSubmitApproval={() => requestSubmitBillingInvoiceApproval(invoice)}
                  onApprove={() => requestReviewBillingInvoice(invoice, "approved")}
                  onReject={() => requestReviewBillingInvoice(invoice, "rejected")}
                  onCancel={() => requestCancelBillingInvoice(invoice)}
                  onDelete={() => requestDeleteBillingInvoice(invoice)}
                  onOpenPdf={(type) => window.open(getBillingPdfUrl(invoice.id, type), "_blank", "noopener,noreferrer")}
                  onShare={() =>
                    shareOnWhatsApp(
                      invoice.customer_mobile,
                      `Namaste ${invoice.customer_name || "Customer"}, your ${displayInvoiceType(invoice.invoice_type)} ${invoice.invoice_number} from AIBA Tiles Agency is ready. Total ${formatCurrency(invoice.grand_total)}.`
                    )
                  }
                  canManageApproval={canManageApproval}
                  canDelete={hasAnyRole(user, ["admin"])}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
                />
              ))}
              {approvalInvoices.length === 0 ? (
                <EmptyState title="Approval queue is clear" message="No customer bills are currently waiting for approval." />
              ) : null}
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}
