import { useEffect, useMemo, useState } from "react";

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getCategorySafetyMargin(category) {
  switch (String(category || "").toLowerCase()) {
    case "granite":
    case "marble":
    case "granite_marble":
      return 16;
    case "plumbing":
      return 20;
    case "adhesive":
      return 11;
    default:
      return 13;
  }
}

function getCategoryGrowthMargin(category) {
  switch (String(category || "").toLowerCase()) {
    case "granite":
    case "marble":
    case "granite_marble":
      return 16;
    case "plumbing":
      return 20;
    case "adhesive":
      return 11;
    default:
      return 14;
  }
}

function getTimeDecayPercent(form) {
  if (form.time_decay_percent !== "" && form.time_decay_percent != null) {
    return Number(form.time_decay_percent || 0);
  }

  const holdingDays = Number(form.holding_days || 0);
  if (holdingDays > 180) return 6;
  if (holdingDays > 90) return 4;
  if (holdingDays > 60) return 2;
  if (holdingDays > 30) return 1;
  return 0;
}

function normalizeMonthlyOverheadMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "per_sqft" || method === "sales_value_wise" || method === "quantity_wise") {
    return method;
  }
  return "per_box";
}

function calculatePreview(form) {
  const minimumMarginPercent = Number(form.minimum_margin_percent || 0);
  const targetMarginPercent = Number(form.target_margin_percent || 0);
  const financedAmount = Number(form.financed_amount || 0);
  const interestRate = Number(form.interest_rate_percent || 0);
  const holdingDays = Number(form.holding_days || 0);
  const timeDecayPercent = getTimeDecayPercent(form);
  const interestCost =
    form.interest_cost_override !== "" && form.interest_cost_override != null
      ? roundMoney(form.interest_cost_override)
      : roundMoney((financedAmount * interestRate * holdingDays) / 36500);

  const charges = {
    freight: Number(form.total_freight_cost || 0),
    unloading: Number(form.total_unloading_cost || 0),
    interest: interestCost,
    overhead: Number(form.showroom_overhead_amount || 0),
    other: Number(form.other_charges || 0),
    marketing: Number(form.marketing_cost_amount || 0),
  };

  const rows = [];
  (form.suppliers || []).forEach((supplier, supplierIndex) => {
    (supplier.items || []).forEach((item, itemIndex) => {
      const quantity = Number(item.quantity || 0);
      const damageQuantity = Number(item.damage_quantity || 0);
      const netUsableQuantity = Math.max(quantity - damageQuantity, 0);
      const purchaseValue = roundMoney(quantity * Number(item.basic_purchase_rate || 0));
      const unit = String(item.unit || "pcs").toLowerCase();
      const boxes = Number(item.boxes || 0) > 0 ? Number(item.boxes || 0) : unit === "box" || unit === "boxes" ? quantity : 0;
      const weightPerBox = Number(item.weight_per_box || 0);
      const weightPerUnit = Number(item.weight_per_unit || 0);
      const totalWeightKg =
        boxes > 0 && weightPerBox > 0
          ? roundMoney(boxes * weightPerBox)
          : weightPerUnit > 0
            ? roundMoney(quantity * weightPerUnit)
            : 0;
      rows.push({
        key: `${supplierIndex}-${itemIndex}`,
        supplierIndex,
        itemIndex,
        supplierName: supplier.supplier_name,
        productName: item.item_name,
        companyName: item.company_name,
        productSize: item.product_size,
        category: item.category || "tiles",
        quantity,
        unit: item.unit || "pcs",
        boxes,
        weightPerBox,
        weightPerUnit,
        totalWeightKg,
        purchaseValue,
        damageQuantity,
        netUsableQuantity,
        supplierAmount: Number(supplier.supplier_amount || purchaseValue),
        manualAllocationValue: Number(item.manual_allocation_value || 0),
      });
    });
  });

  const totalPurchaseValue = rows.reduce((sum, item) => sum + Number(item.purchaseValue || 0), 0);
  const totalQuantity = rows.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalWeightKg = rows.reduce((sum, item) => sum + Number(item.totalWeightKg || 0), 0);
  const totalSupplierAmount = rows.reduce((sum, item) => sum + Number(item.supplierAmount || 0), 0);
  const totalManualAllocationValue = rows.reduce((sum, item) => sum + Number(item.manualAllocationValue || 0), 0);
  const allocationMethod = form.allocation_method || "weight_wise";
  const monthlyOverheadMethod = normalizeMonthlyOverheadMethod(form.monthly_overhead_allocation_method);
  const monthlyOverhead = Number(form.monthly_overhead_amount || 0);
  const monthlySalesBoxes = Number(form.monthly_sales_boxes || 0);
  const monthlySalesSqft = Number(form.monthly_sales_sqft || 0);
  const monthlySalesQuantity = Number(form.monthly_sales_quantity || 0);
  const monthlySalesValue = Number(form.monthly_sales_value || 0);
  const monthlyOverheadDenominator =
    monthlyOverheadMethod === "per_sqft"
      ? monthlySalesSqft
      : monthlyOverheadMethod === "quantity_wise"
        ? monthlySalesQuantity
        : monthlyOverheadMethod === "sales_value_wise"
          ? monthlySalesValue
          : monthlySalesBoxes;
  const monthlyOverheadRate =
    monthlyOverhead > 0 && monthlyOverheadDenominator > 0
      ? roundMoney(monthlyOverhead / monthlyOverheadDenominator)
      : 0;
  const freightPerKg = totalWeightKg > 0 ? roundMoney(charges.freight / totalWeightKg) : 0;

  const previewItems = rows.map((item) => {
    const itemSqft = item.boxes > 0 && Number(form.suppliers?.[item.supplierIndex]?.items?.[item.itemIndex]?.sqft_per_box || 0) > 0
      ? roundMoney(item.boxes * Number(form.suppliers?.[item.supplierIndex]?.items?.[item.itemIndex]?.sqft_per_box || 0))
      : item.unit === "sqft"
        ? roundMoney(item.quantity)
        : 0;
    const base =
      allocationMethod === "quantity_wise" || allocationMethod === "by_quantity"
        ? Number(item.quantity || 0)
        : allocationMethod === "manual"
          ? Number(item.manualAllocationValue || 0)
          : allocationMethod === "supplier_amount_wise"
            ? Number(item.supplierAmount || 0)
            : Number(item.purchaseValue || 0);
    const denominator =
      allocationMethod === "quantity_wise" || allocationMethod === "by_quantity"
        ? totalQuantity || 1
        : allocationMethod === "manual"
          ? totalManualAllocationValue || totalPurchaseValue || 1
          : allocationMethod === "supplier_amount_wise"
            ? totalSupplierAmount || totalPurchaseValue || 1
            : totalPurchaseValue || 1;
    const share = denominator > 0 ? base / denominator : 0;
    const allocatedFreight =
      allocationMethod === "weight_wise" && item.totalWeightKg > 0 && totalWeightKg > 0
        ? roundMoney(item.totalWeightKg * freightPerKg)
        : roundMoney(charges.freight * share);
    const allocatedUnloading = roundMoney(charges.unloading * share);
    const allocatedInterest = roundMoney(charges.interest * share);
    const allocatedOverhead = roundMoney(charges.overhead * share);
    const allocatedOther = roundMoney(charges.other * share);
    const allocatedMarketing = roundMoney(charges.marketing * share);
    const finalLandedCost = roundMoney(
      Number(item.purchaseValue || 0) +
        allocatedFreight +
        allocatedUnloading +
        allocatedOverhead +
        allocatedOther
    );
    const timeDecayCost = roundMoney(finalLandedCost * (timeDecayPercent / 100));
    const realCost = roundMoney(finalLandedCost + allocatedInterest + timeDecayCost + allocatedMarketing);
    const overheadBasis =
      monthlyOverheadMethod === "per_sqft"
        ? itemSqft
        : monthlyOverheadMethod === "quantity_wise"
          ? Number(item.quantity || 0)
          : monthlyOverheadMethod === "sales_value_wise"
            ? Number(item.purchaseValue || 0)
            : Number(item.boxes || 0);
    const allocatedMonthlyOverhead = roundMoney(overheadBasis * monthlyOverheadRate);
    const finalBusinessCost = roundMoney(realCost + allocatedMonthlyOverhead);
    const landedCostPerUnit =
      Number(item.netUsableQuantity || 0) > 0
        ? roundMoney(finalLandedCost / Number(item.netUsableQuantity))
        : 0;
    const realCostPerUnit =
      Number(item.netUsableQuantity || 0) > 0
        ? roundMoney(realCost / Number(item.netUsableQuantity))
        : 0;
    const overheadCostPerUnit =
      Number(item.netUsableQuantity || 0) > 0
        ? roundMoney(allocatedMonthlyOverhead / Number(item.netUsableQuantity))
        : 0;
    const finalBusinessCostPerUnit =
      Number(item.netUsableQuantity || 0) > 0
        ? roundMoney(finalBusinessCost / Number(item.netUsableQuantity))
        : 0;
    const effectiveSafetyMargin = minimumMarginPercent > 0 ? minimumMarginPercent : getCategorySafetyMargin(item.category);
    const effectiveGrowthMargin = targetMarginPercent > 0 ? targetMarginPercent : getCategoryGrowthMargin(item.category);
    const minimumAllowedRate = roundMoney(
      realCostPerUnit + realCostPerUnit * (effectiveSafetyMargin / 100)
    );
    const suggestedSellingRate = roundMoney(
      minimumAllowedRate + minimumAllowedRate * (effectiveGrowthMargin / 100)
    );

    return {
      ...item,
      allocatedFreight,
      allocatedUnloading,
      allocatedInterest,
      allocatedOverhead,
      allocatedOther,
      allocatedMarketing,
      timeDecayCost,
      finalLandedCost,
      realCost,
      allocatedMonthlyOverhead,
      finalBusinessCost,
      landedCostPerUnit,
      realCostPerUnit,
      overheadCostPerUnit,
      finalBusinessCostPerUnit,
      minimumAllowedRate,
      suggestedSellingRate,
      weightWarning: allocationMethod === "weight_wise" && !(item.totalWeightKg > 0),
    };
  });

  return {
    interestCost,
    timeDecayPercent,
    totalPurchaseValue,
    totalTruckWeightKg: roundMoney(totalWeightKg),
    freightPerKg,
    totalRealCost: roundMoney(previewItems.reduce((sum, item) => sum + Number(item.realCost || 0), 0)),
    totalFinalBusinessCost: roundMoney(previewItems.reduce((sum, item) => sum + Number(item.finalBusinessCost || 0), 0)),
    monthlyOverhead,
    monthlyOverheadMethod,
    monthlySalesBoxes,
    monthlySalesSqft,
    monthlySalesQuantity,
    monthlySalesValue,
    monthlyOverheadRate,
    overheadWarning: monthlyOverhead > 0 && monthlyOverheadDenominator <= 0,
    missingWeightItemsCount: previewItems.filter((item) => item.weightWarning).length,
    totalNetUsableQuantity: roundMoney(
      previewItems.reduce((sum, item) => sum + Number(item.netUsableQuantity || 0), 0)
    ),
    items: previewItems,
  };
}

function getPurchaseRateInsight(intelligence, currentRate) {
  const averageRate = Number(intelligence?.avg_30_day_rate || 0);
  const current = Number(currentRate || 0);

  if (!(averageRate > 0) || !(current > 0)) {
    return {
      differenceAmount: 0,
      differencePercentage: 0,
      status: "normal",
      approvalRequired: false,
    };
  }

  const differenceAmount = Number((current - averageRate).toFixed(2));
  const differencePercentage = Number(((differenceAmount / averageRate) * 100).toFixed(2));

  if (differencePercentage > 8) {
    return {
      differenceAmount,
      differencePercentage,
      status: "approval_required",
      approvalRequired: true,
    };
  }

  if (differencePercentage > 3) {
    return {
      differenceAmount,
      differencePercentage,
      status: "review",
      approvalRequired: false,
    };
  }

  return {
    differenceAmount,
    differencePercentage,
    status: "normal",
    approvalRequired: false,
  };
}

function PurchaseIntelligenceInline({
  productId,
  currentRate,
  purchaseIntelligenceCache,
  purchaseIntelligenceLoading,
  fetchPurchaseProductIntelligence,
  formatCurrency,
  formatDate,
}) {
  useEffect(() => {
    if (productId && !purchaseIntelligenceCache[productId]) {
      fetchPurchaseProductIntelligence(productId);
    }
  }, [fetchPurchaseProductIntelligence, productId, purchaseIntelligenceCache]);

  if (!productId) {
    return null;
  }

  const loading = purchaseIntelligenceLoading[productId];
  const intelligence = purchaseIntelligenceCache[productId] || null;

  if (loading && !intelligence) {
    return (
      <div className="purchase-intelligence-panel compact inline">
        <div className="section-head">
          <div>
            <h3>Purchase Intelligence</h3>
            <p className="muted">Loading rate history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="purchase-intelligence-panel compact inline">
        <div className="section-head">
          <div>
            <h3>Purchase Intelligence</h3>
            <p className="muted">No recent purchase history found for this product yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const insight = getPurchaseRateInsight(intelligence, currentRate);
  const statusLabel =
    insight.status === "approval_required"
      ? "Approval Required"
      : insight.status === "review"
        ? "Review"
        : "Normal";

  return (
    <div className="purchase-intelligence-panel compact inline">
      <div className="section-head">
        <div>
          <h3>Purchase Intelligence</h3>
          <p className="muted">Use recent product buying history to review this purchase rate.</p>
        </div>
        <span className={`status-chip status-${insight.status === "approval_required" ? "urgent" : insight.status === "review" ? "pending" : "active"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="purchase-intelligence-grid">
        <div className="mini-card"><strong>Current</strong><p>{currentRate > 0 ? formatCurrency(currentRate) : "Enter rate"}</p></div>
        <div className="mini-card"><strong>Last Rate</strong><p>{formatCurrency(intelligence.last_purchase_rate || 0)}</p></div>
        <div className="mini-card"><strong>30-day Avg</strong><p>{formatCurrency(intelligence.avg_30_day_rate || 0)}</p></div>
        <div className="mini-card">
          <strong>Difference</strong>
          <p>
            {currentRate > 0 && intelligence.avg_30_day_rate > 0
              ? `${insight.differenceAmount >= 0 ? "+" : ""}${formatCurrency(Math.abs(insight.differenceAmount))} / ${insight.differencePercentage >= 0 ? "+" : ""}${insight.differencePercentage}%`
              : "Waiting for rate"}
          </p>
        </div>
        <div className="mini-card">
          <strong>Supplier Suggestion</strong>
          <p>
            {intelligence.recommended_supplier
              ? `${intelligence.recommended_supplier} · ${formatCurrency(intelligence.best_supplier_rate || 0)}`
              : "Not available"}
          </p>
        </div>
        <div className="mini-card"><strong>Trend</strong><p>{intelligence.trend || "stable"}</p></div>
      </div>
      <div className="purchase-intelligence-meta">
        <span>Lowest {formatCurrency(intelligence.min_rate || 0)}</span>
        <span>Highest {formatCurrency(intelligence.max_rate || 0)}</span>
        <span>Last Supplier {intelligence.last_supplier || "Not available"}</span>
      </div>
      {(intelligence.supplier_comparison || []).length ? (
        <div className="mini-list compact">
          {intelligence.supplier_comparison.slice(0, 3).map((supplier) => (
            <div key={`${supplier.supplier_name}-${supplier.last_purchase_date}`} className="timeline-item compact">
              <strong>{supplier.supplier_name}</strong>
              <p className="muted">
                {formatCurrency(supplier.last_rate)} | Qty {supplier.quantity || 0} | {formatDate(supplier.last_purchase_date)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {insight.approvalRequired ? (
        <p className="field-error-message">
          Current purchase rate is above the 30-day average threshold. Draft save is allowed, but manager/admin approval should be used before final lot approval.
        </p>
      ) : null}
    </div>
  );
}

function LotCard({
  lot,
  selected,
  onSelect,
  onEdit,
  onApprove,
  onCancel,
  canApprove,
  formatDate,
  formatDateTime,
}) {
  return (
    <article className={`lead-card purchase-lot-card ${selected ? "active" : ""}`} onClick={onSelect}>
      <div className="section-head">
        <div>
          <h3>{lot.lot_number}</h3>
          <p className="muted">
            {formatDate(lot.arrival_date)} | {lot.vehicle_number || "No vehicle"}
          </p>
        </div>
        <span className={`status-chip status-${lot.status}`}>{lot.status.replaceAll("_", " ")}</span>
      </div>
      <p className="lead-card-line">
        Freight {formatCurrency(lot.total_freight_cost)} | Unloading {formatCurrency(lot.total_unloading_cost)}
      </p>
      <p className="lead-card-line">
        Purchase {formatCurrency(lot.total_purchase_value)} | Net usable {lot.total_net_usable_quantity || 0}
      </p>
      <p className="muted lead-card-line">
        Created by {lot.created_by_user_name || "System"} {lot.created_at ? `| ${formatDateTime(lot.created_at)}` : ""}
      </p>
      <div className="billing-actions">
        <button
          type="button"
          className="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          View Detail
        </button>
        {lot.status !== "approved" && lot.status !== "cancelled" ? (
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
        {canApprove && lot.status !== "approved" && lot.status !== "cancelled" ? (
          <button
            type="button"
            className="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onApprove();
            }}
          >
            Approve Lot
          </button>
        ) : null}
        {canApprove && lot.status !== "cancelled" ? (
          <button
            type="button"
            className="secondary danger-soft"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function PurchaseCostingSection(props) {
  const {
    purchaseCostingSummary,
    purchaseCostingReports,
    purchaseCostingProductOptions,
    purchaseIntelligenceCache,
    purchaseIntelligenceLoading,
    purchaseCostingForm,
    purchaseCostingFormErrors,
    editingPurchaseLotId,
    selectedPurchaseLot,
    setSelectedPurchaseLot,
    updatePurchaseCostingField,
    updatePurchaseCostingSupplier,
    updatePurchaseCostingItem,
    handlePurchaseCostingProductChange,
    fetchPurchaseProductIntelligence,
    addPurchaseCostingSupplier,
    removePurchaseCostingSupplier,
    addPurchaseCostingItem,
    removePurchaseCostingItem,
    handleSavePurchaseCostingLot,
    handleCancelPurchaseCostingEdit,
    handleOpenPurchaseLotDetail,
    startEditingPurchaseCostingLot,
    handleApprovePurchaseLot,
    handleCancelPurchaseLot,
    filteredPurchaseLots,
    purchaseLotSearch,
    setPurchaseLotSearch,
    purchaseLotStatusFilter,
    setPurchaseLotStatusFilter,
    linkedPurchaseBills,
    linkedPurchaseBillsLoading,
    listLimits,
    increaseListLimit,
    ListLoadControls,
    busyAction,
    loading,
    formatDate,
    formatDateTime,
    EmptyState,
    HighlightRow,
    StatCard,
    getFieldErrorClass,
    user,
    hasAnyRole,
  } = props;

  const [activeTab, setActiveTab] = useState("new_lot");
  const [entryStep, setEntryStep] = useState(1);
  const preview = useMemo(
    () =>
      calculatePreview({
        ...purchaseCostingForm,
        monthly_overhead_amount:
          purchaseCostingForm.monthly_overhead_amount || purchaseCostingSummary?.monthly_overhead_amount || 0,
        monthly_sales_boxes:
          purchaseCostingForm.monthly_sales_boxes || purchaseCostingSummary?.monthly_sales_boxes || 0,
        monthly_sales_sqft:
          purchaseCostingForm.monthly_sales_sqft || purchaseCostingSummary?.monthly_sales_sqft || 0,
        monthly_sales_quantity:
          purchaseCostingForm.monthly_sales_quantity || purchaseCostingSummary?.monthly_sales_quantity || 0,
        monthly_sales_value:
          purchaseCostingForm.monthly_sales_value || purchaseCostingSummary?.monthly_sales_value || 0,
      }),
    [purchaseCostingForm, purchaseCostingSummary]
  );
  const canApprove = hasAnyRole(user, ["admin", "manager"]);
  const canEdit = hasAnyRole(user, ["admin", "manager", "inventory", "accounts", "operator"]);
  const purchaseLots = filteredPurchaseLots || [];
  const wizardSteps = [
    { id: 1, title: "Truck Details", note: "Enter truck number and delivery date to link purchase bills" },
    { id: 2, title: "Linked Purchase Bills", note: "Read-only purchase invoices and product rows linked to this truck" },
    { id: 3, title: "Cost Inputs", note: "Freight, interest, overhead, time decay and marketing" },
    { id: 4, title: "Calculated Results", note: "Read-only landed cost, real cost, rates and warnings" },
  ];

  const reportCards = useMemo(
    () => [
      { label: "Lot-wise Costing", value: purchaseCostingReports?.lot_wise_costing?.length ?? 0 },
      { label: "Supplier-wise Cost", value: purchaseCostingReports?.supplier_wise_purchase_cost?.length ?? 0 },
      { label: "Product Real Cost", value: purchaseCostingReports?.product_wise_landed_cost?.length ?? 0 },
      { label: "Damage / Decay", value: purchaseCostingReports?.damage_decay_report?.length ?? 0 },
      { label: "Freight by Weight", value: purchaseCostingReports?.freight_allocation_report?.length ?? 0 },
      { label: "Low Margin Warnings", value: purchaseCostingReports?.low_margin_warning_report?.length ?? 0 },
    ],
    [purchaseCostingReports]
  );
  const approvalLots = useMemo(
    () => purchaseLots.filter((lot) => lot.status === "draft" || lot.status === "cost_calculated"),
    [purchaseLots]
  );

  const detailLot = selectedPurchaseLot;

  return (
    <section className="billing-workspace purchase-costing-workspace">
      <section className="panel billing-summary-panel">
        <div className="section-head">
          <div>
            <h2>Purchase Costing</h2>
            <p className="muted">Truck-wise landed cost, margin guidance and approval before stock hits inventory.</p>
          </div>
        </div>
        <div className="stats-grid billing-summary-grid purchase-costing-summary-grid">
          <StatCard title="Lots" value={purchaseCostingSummary?.total_lots ?? 0} />
          <StatCard title="Approved" value={purchaseCostingSummary?.approved_lots ?? 0} />
          <StatCard title="Purchase Value" value={formatCurrency(purchaseCostingSummary?.total_purchase_value || 0)} />
          <StatCard title="Freight" value={formatCurrency(purchaseCostingSummary?.total_freight_cost || 0)} />
          <StatCard title="Unloading" value={formatCurrency(purchaseCostingSummary?.total_unloading_cost || 0)} />
          <StatCard title="Truck Weight" value={purchaseCostingSummary?.total_truck_weight_kg ?? 0} />
          <StatCard title="Real Cost" value={formatCurrency(purchaseCostingSummary?.total_real_cost || 0)} />
          <StatCard title="Monthly Overhead" value={formatCurrency(purchaseCostingSummary?.monthly_overhead_amount || 0)} />
          <StatCard title="Final Business Cost" value={formatCurrency(purchaseCostingSummary?.total_final_business_cost || 0)} />
          <StatCard title="Net Usable Qty" value={purchaseCostingSummary?.total_net_usable_quantity ?? 0} />
        </div>
        <div className="billing-tab-nav purchase-costing-tab-nav">
          {[
            { id: "new_lot", label: "New Lot" },
            { id: "ledger", label: "Lot Ledger" },
            { id: "reports", label: "Costing Report" },
            { id: "approval", label: "Approval Queue" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active-nav" : "nav-btn"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "new_lot" ? (
        <section className="stack">
          <section className="panel">
            <form
              className="stack"
              onSubmit={handleSavePurchaseCostingLot}
            >
              <div className="section-head">
                <div>
                  <h3>{editingPurchaseLotId ? "Edit purchase lot" : "New purchase lot"}</h3>
                  <p className="muted">Fill step by step: truck details, linked purchase bills, cost inputs, then review final results.</p>
                </div>
                {editingPurchaseLotId ? (
                  <button type="button" className="secondary" onClick={handleCancelPurchaseCostingEdit}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="module-nav billing-tab-nav purchase-costing-tab-nav">
                {wizardSteps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`module-link ${entryStep === step.id ? "active" : ""}`}
                    onClick={() => setEntryStep(step.id)}
                  >
                    Step {step.id}: {step.title}
                  </button>
                ))}
              </div>

              <section className="panel panel-nested">
                <div className="section-head">
                  <div>
                    <h3>Step {entryStep}: {wizardSteps.find((step) => step.id === entryStep)?.title}</h3>
                    <p className="muted">{wizardSteps.find((step) => step.id === entryStep)?.note}</p>
                  </div>
                </div>

                {entryStep === 1 ? (
                  <div className="form-grid purchase-costing-grid">
                    <div className="form-field">
                      <label>Truck Number <span className="required-marker">*</span></label>
                      <input
                        data-field="lot_number"
                        className={getFieldErrorClass(purchaseCostingFormErrors, "lot_number")}
                        value={purchaseCostingForm.lot_number}
                        onChange={(event) => updatePurchaseCostingField("lot_number", event.target.value)}
                      />
                      {purchaseCostingFormErrors.lot_number ? <span className="field-error-message">{purchaseCostingFormErrors.lot_number}</span> : null}
                    </div>
                    <div className="form-field">
                      <label>Delivery / Arrival Date <span className="required-marker">*</span></label>
                      <input
                        data-field="arrival_date"
                        className={getFieldErrorClass(purchaseCostingFormErrors, "arrival_date")}
                        type="date"
                        value={purchaseCostingForm.arrival_date}
                        onChange={(event) => updatePurchaseCostingField("arrival_date", event.target.value)}
                      />
                      {purchaseCostingFormErrors.arrival_date ? <span className="field-error-message">{purchaseCostingFormErrors.arrival_date}</span> : null}
                    </div>
                    <input placeholder="Vehicle Number (optional)" value={purchaseCostingForm.vehicle_number} onChange={(event) => updatePurchaseCostingField("vehicle_number", event.target.value)} />
                    <textarea className="full-span" placeholder="Remarks" value={purchaseCostingForm.remarks} onChange={(event) => updatePurchaseCostingField("remarks", event.target.value)} />
                  </div>
                ) : null}

                {entryStep === 2 ? (
                  <div className="stack purchase-costing-suppliers">
                <div className="section-head">
                  <h3>Linked Purchase Bills</h3>
                </div>
                {linkedPurchaseBillsLoading ? <p className="muted">Loading linked purchase bills...</p> : null}
                {!(linkedPurchaseBills || []).length && !(purchaseCostingForm.suppliers || []).some((supplier) => (supplier.items || []).length) ? (
                  <EmptyState
                    title="No linked purchase bills"
                    message="No purchase bills found for this truck/date. First create purchase invoices with same truck number and delivery date."
                  />
                ) : null}
                {(purchaseCostingForm.suppliers || []).map((supplier, supplierIndex) => (
                  <section key={`supplier-${supplierIndex}`} className="mini-card purchase-supplier-card">
                    <div className="section-head">
                      <div>
                        <strong>{supplier.supplier_name || `Supplier ${supplierIndex + 1}`}</strong>
                        <p className="muted">
                          Invoice {supplier.supplier_invoice_number || "-"} | Date {supplier.supplier_invoice_date ? formatDate(supplier.supplier_invoice_date) : "Not available"} | Total {formatCurrency(supplier.supplier_amount || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="mini-list">
                      {(supplier.items || []).map((item, itemIndex) => (
                        <div key={`supplier-${supplierIndex}-item-${itemIndex}`} className="timeline-item">
                          <strong>{item.item_name || "Unnamed Product"}</strong>
                          <p className="muted">
                            {item.company_name || "No company"} | {item.product_size || "No size"} | {item.category || "tiles"}
                          </p>
                          <p>
                            Qty {item.quantity || 0} {item.unit || "pcs"} | Rate {formatCurrency(item.basic_purchase_rate || 0)} | Value {formatCurrency(Number(item.quantity || 0) * Number(item.basic_purchase_rate || 0))}
                          </p>
                          {item.product_id ? (
                            <PurchaseIntelligenceInline
                              productId={Number(item.product_id)}
                              currentRate={Number(item.basic_purchase_rate || 0)}
                              purchaseIntelligenceCache={purchaseIntelligenceCache}
                              purchaseIntelligenceLoading={purchaseIntelligenceLoading}
                              fetchPurchaseProductIntelligence={fetchPurchaseProductIntelligence}
                              formatCurrency={formatCurrency}
                              formatDate={formatDate}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                  </div>
                ) : null}

                {entryStep === 3 ? (
                  <div className="form-grid purchase-costing-grid">
                    <select value={purchaseCostingForm.allocation_method} onChange={(event) => updatePurchaseCostingField("allocation_method", event.target.value)}>
                      <option value="weight_wise">Weight-wise</option>
                      <option value="purchase_value_wise">Purchase Value-wise</option>
                      <option value="quantity_wise">Quantity-wise</option>
                      <option value="supplier_amount_wise">Supplier Amount-wise</option>
                      <option value="manual">Manual Allocation</option>
                    </select>
                    <input type="number" step="0.01" placeholder="Freight Cost" value={purchaseCostingForm.total_freight_cost} onChange={(event) => updatePurchaseCostingField("total_freight_cost", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Unloading Cost" value={purchaseCostingForm.total_unloading_cost} onChange={(event) => updatePurchaseCostingField("total_unloading_cost", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Other Charges" value={purchaseCostingForm.other_charges} onChange={(event) => updatePurchaseCostingField("other_charges", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Financed Amount" value={purchaseCostingForm.financed_amount} onChange={(event) => updatePurchaseCostingField("financed_amount", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Interest %" value={purchaseCostingForm.interest_rate_percent} onChange={(event) => updatePurchaseCostingField("interest_rate_percent", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Holding Days" value={purchaseCostingForm.holding_days} onChange={(event) => updatePurchaseCostingField("holding_days", event.target.value)} />
                    <input type="date" value={purchaseCostingForm.stock_received_date} onChange={(event) => updatePurchaseCostingField("stock_received_date", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Manual Interest Override" value={purchaseCostingForm.interest_cost_override} onChange={(event) => updatePurchaseCostingField("interest_cost_override", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Showroom Overhead" value={purchaseCostingForm.showroom_overhead_amount} onChange={(event) => updatePurchaseCostingField("showroom_overhead_amount", event.target.value)} />
                    <select value={purchaseCostingForm.monthly_overhead_allocation_method} onChange={(event) => updatePurchaseCostingField("monthly_overhead_allocation_method", event.target.value)}>
                      <option value="per_box">Monthly Overhead per box</option>
                      <option value="per_sqft">Monthly Overhead per sqft</option>
                      <option value="sales_value_wise">Monthly Overhead by sales value</option>
                      <option value="quantity_wise">Monthly Overhead by quantity</option>
                    </select>
                    <div className="mini-card compact-line">
                      Monthly overhead snapshot: {formatCurrency(Number(purchaseCostingForm.monthly_overhead_amount || purchaseCostingSummary?.monthly_overhead_amount || 0))}
                    </div>
                    <div className="mini-card compact-line">
                      Overhead rate: {formatCurrency(Number(purchaseCostingForm.monthly_overhead_rate || purchaseCostingSummary?.monthly_overhead_rate || 0))}
                    </div>
                    <input type="number" step="0.01" placeholder="Time Decay %" value={purchaseCostingForm.time_decay_percent} onChange={(event) => updatePurchaseCostingField("time_decay_percent", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Marketing Cost" value={purchaseCostingForm.marketing_cost_amount} onChange={(event) => updatePurchaseCostingField("marketing_cost_amount", event.target.value)} />
                    <select value={purchaseCostingForm.marketing_cost_allocation_method} onChange={(event) => updatePurchaseCostingField("marketing_cost_allocation_method", event.target.value)}>
                      <option value="manual">Marketing Manual</option>
                      <option value="purchase_value_wise">Marketing by Value</option>
                      <option value="quantity_wise">Marketing by Qty</option>
                    </select>
                    <input placeholder="Overhead Period" value={purchaseCostingForm.overhead_period} onChange={(event) => updatePurchaseCostingField("overhead_period", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Minimum Margin %" value={purchaseCostingForm.minimum_margin_percent} onChange={(event) => updatePurchaseCostingField("minimum_margin_percent", event.target.value)} />
                    <input type="number" step="0.01" placeholder="Target Margin %" value={purchaseCostingForm.target_margin_percent} onChange={(event) => updatePurchaseCostingField("target_margin_percent", event.target.value)} />
                    <textarea className="full-span" placeholder="Overhead Notes" value={purchaseCostingForm.overhead_notes} onChange={(event) => updatePurchaseCostingField("overhead_notes", event.target.value)} />
                  </div>
                ) : null}

                {entryStep === 4 ? (
                  <section className="stack">
                    <div className="section-head">
                      <div>
                        <h3>Calculated Results</h3>
                        <p className="muted">Read-only landed cost, real cost, final business cost, rates and warnings.</p>
                      </div>
                      <div className="hero-pills">
                        <span className="hero-pill hero-pill-strong">Interest {formatCurrency(preview.interestCost)}</span>
                        <span className="hero-pill">Purchase {formatCurrency(preview.totalPurchaseValue)}</span>
                        <span className="hero-pill">Truck Weight {preview.totalTruckWeightKg} kg</span>
                        <span className="hero-pill">Freight / KG {formatCurrency(preview.freightPerKg)}</span>
                        <span className="hero-pill">Real Cost {formatCurrency(preview.totalRealCost)}</span>
                        <span className="hero-pill">Monthly Overhead {formatCurrency(preview.monthlyOverhead)}</span>
                        <span className="hero-pill">Overhead Rate {formatCurrency(preview.monthlyOverheadRate)}</span>
                        <span className="hero-pill hero-pill-strong">Final Business {formatCurrency(preview.totalFinalBusinessCost)}</span>
                        <span className="hero-pill">Net usable {preview.totalNetUsableQuantity}</span>
                      </div>
                    </div>
                    {preview.missingWeightItemsCount ? (
                      <p className="field-error-message">
                        {preview.missingWeightItemsCount} item(s) are missing weight data. Freight falls back safely and draft save is still allowed.
                      </p>
                    ) : null}
                    {preview.overheadWarning ? (
                      <p className="field-error-message">
                        Overhead not calculated because monthly sales basis is zero for the selected allocation mode.
                      </p>
                    ) : null}
                    <div className="mini-list">
                      {(preview.items || []).map((item) => (
                        <div key={item.key} className="timeline-item">
                          <strong>{item.productName || "Unnamed Product"}</strong>
                          <p className="muted">
                            {item.supplierName || "No supplier"} | {item.companyName || "No company"} | {item.productSize || "No size"}
                          </p>
                          <p className="muted">
                            Qty {item.quantity} {item.unit} | Boxes {item.boxes || 0} | Weight {item.totalWeightKg || 0} kg | Damage {item.damageQuantity}
                          </p>
                          <div className="billing-detail-grid">
                            <HighlightRow label="Net usable" value={item.netUsableQuantity} />
                            <HighlightRow label="Freight" value={formatCurrency(item.allocatedFreight)} />
                            <HighlightRow label="Unloading" value={formatCurrency(item.allocatedUnloading)} />
                            <HighlightRow label="Interest" value={formatCurrency(item.allocatedInterest)} />
                            <HighlightRow label="Overhead" value={formatCurrency(item.allocatedOverhead)} />
                            <HighlightRow label="Monthly Overhead" value={formatCurrency(item.allocatedMonthlyOverhead)} />
                            <HighlightRow label="Time Decay" value={formatCurrency(item.timeDecayCost)} />
                            <HighlightRow label="Marketing" value={formatCurrency(item.allocatedMarketing)} />
                            <HighlightRow label="Landed / unit" value={formatCurrency(item.landedCostPerUnit)} />
                            <HighlightRow label="Real / unit" value={formatCurrency(item.realCostPerUnit)} tone="danger" />
                            <HighlightRow label="Overhead / unit" value={formatCurrency(item.overheadCostPerUnit)} />
                            <HighlightRow label="Final Business / unit" value={formatCurrency(item.finalBusinessCostPerUnit)} tone="danger" />
                            <HighlightRow label="Minimum Rate" value={formatCurrency(item.minimumAllowedRate)} tone="danger" />
                            <HighlightRow label="Suggested Rate" value={formatCurrency(item.suggestedSellingRate)} tone="accent" />
                          </div>
                          {item.weightWarning ? <p className="field-error-message">Weight missing. Freight fallback used for this item.</p> : null}
                        </div>
                      ))}
                      {!preview.items.length ? <p className="muted">Add supplier product rows to preview landed costing.</p> : null}
                    </div>
                  </section>
                ) : null}
              </section>

              <div className="billing-actions">
                <button type="button" className="secondary" onClick={() => setEntryStep((current) => Math.max(1, current - 1))} disabled={entryStep === 1}>
                  Back
                </button>
                {entryStep < 4 ? (
                  <button type="button" className="secondary" onClick={() => setEntryStep((current) => Math.min(4, current + 1))}>
                    Next
                  </button>
                ) : null}
              </div>

              {canEdit ? (
                <div className="billing-actions billing-actions-primary">
                  <button type="submit" disabled={busyAction === "save-purchase-costing" || entryStep !== 4}>
                    {busyAction === "save-purchase-costing"
                      ? "Saving Lot..."
                      : editingPurchaseLotId
                        ? "Update Lot"
                        : "Save Lot"}
                  </button>
                </div>
              ) : null}
            </form>
          </section>
        </section>
      ) : null}

      {activeTab === "ledger" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="section-head">
              <div>
                <h3>Lot Ledger</h3>
                <p className="muted">Review truck lots before or after stock approval.</p>
              </div>
            </div>
            <div className="form-grid purchase-costing-grid">
              <input
                placeholder="Search lot, vehicle, transporter"
                value={purchaseLotSearch}
                onChange={(event) => setPurchaseLotSearch(event.target.value)}
              />
              <select value={purchaseLotStatusFilter} onChange={(event) => setPurchaseLotStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="cost_calculated">Cost Calculated</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="mini-list">
              {purchaseLots.map((lot) => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  selected={selectedPurchaseLot?.id === lot.id}
                  onSelect={() => handleOpenPurchaseLotDetail(lot.id)}
                  onEdit={() => startEditingPurchaseCostingLot(lot)}
                  onApprove={() => handleApprovePurchaseLot(lot)}
                  onCancel={() => handleCancelPurchaseLot(lot)}
                  canApprove={canApprove}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
                />
              ))}
              {!purchaseLots.length && !loading ? (
                <EmptyState compact title="No purchase lots yet" message="Create a truck lot to start landed cost tracking." />
              ) : null}
            </div>
            <ListLoadControls
              count={purchaseLots.length}
              limit={listLimits.purchaseLots}
              onLoadMore={() => increaseListLimit("purchaseLots", 50)}
              hasMore={purchaseLots.length >= listLimits.purchaseLots}
            />
          </section>
          <section className="panel">
            {detailLot ? (
              <>
                <div className="section-head">
                  <div>
                    <h3>{detailLot.lot_number}</h3>
                    <p className="muted">
                      {formatDate(detailLot.arrival_date)} | {detailLot.transporter_name || "No transporter"} |{" "}
                      {detailLot.vehicle_number || "No vehicle"}
                    </p>
                  </div>
                  <span className={`status-chip status-${detailLot.status}`}>{detailLot.status.replaceAll("_", " ")}</span>
                </div>
                <div className="billing-detail-grid">
                  <HighlightRow label="Purchase Value" value={formatCurrency(detailLot.total_purchase_value || 0)} />
                  <HighlightRow label="Freight" value={formatCurrency(detailLot.total_freight_cost || 0)} />
                  <HighlightRow label="Unloading" value={formatCurrency(detailLot.total_unloading_cost || 0)} />
                  <HighlightRow label="Interest" value={formatCurrency(detailLot.interest_cost || 0)} />
                  <HighlightRow label="Overhead" value={formatCurrency(detailLot.showroom_overhead_amount || 0)} />
                  <HighlightRow label="Monthly Overhead" value={formatCurrency(detailLot.monthly_overhead_amount || 0)} />
                  <HighlightRow label="Marketing" value={formatCurrency(detailLot.marketing_cost_amount || 0)} />
                  <HighlightRow label="Time Decay" value={formatCurrency(detailLot.time_decay_cost || 0)} />
                  <HighlightRow label="Truck Weight" value={detailLot.total_truck_weight_kg || 0} />
                  <HighlightRow label="Freight / KG" value={formatCurrency(detailLot.freight_per_kg || 0)} />
                  <HighlightRow label="Overhead Method" value={detailLot.monthly_overhead_allocation_method || "per_box"} />
                  <HighlightRow label="Overhead Rate" value={formatCurrency(detailLot.monthly_overhead_rate || 0)} />
                  <HighlightRow label="Final Business Cost" value={formatCurrency(detailLot.total_final_business_cost || 0)} />
                  <HighlightRow label="Other Charges" value={formatCurrency(detailLot.other_charges || 0)} />
                  <HighlightRow label="Min Margin %" value={detailLot.minimum_margin_percent || 0} />
                  <HighlightRow label="Target Margin %" value={detailLot.target_margin_percent || 0} />
                </div>
                <div className="stack">
                  <h3>Products</h3>
                  <div className="mini-list">
                    {(detailLot.items || []).map((item) => (
                      <div key={item.id} className="timeline-item">
                        <strong>{item.item_name}</strong>
                        <p className="muted">
                          {item.company_name || "No company"} | {item.product_size || "No size"} | Qty {item.quantity} {item.unit}
                        </p>
                        <p>
                          Weight {item.total_weight_kg || 0} kg | Damage {item.damage_quantity} | Net {item.net_usable_quantity}
                        </p>
                        <p>
                          Landed / unit {formatCurrency(item.landed_cost_per_unit)} | Real / unit {formatCurrency(item.real_cost_per_unit || 0)} | Overhead / unit {formatCurrency(item.overhead_cost_per_unit || 0)} | Final Business / unit {formatCurrency(item.final_business_cost_per_unit || 0)} | Min {formatCurrency(item.minimum_allowed_rate)} | Suggested {formatCurrency(item.suggested_selling_rate)}
                        </p>
                        {item.overhead_warning ? <p className="field-error-message">{item.overhead_warning}</p> : null}
                      </div>
                    ))}
                    {!detailLot.items?.length ? <p className="muted">No product rows inside this lot yet.</p> : null}
                  </div>
                </div>
                <div className="stack">
                  <h3>Activity</h3>
                  <div className="mini-list">
                    {(detailLot.activities || []).map((activity) => (
                      <div key={activity.id} className="timeline-item">
                        <strong>{activity.action.replaceAll("_", " ")}</strong>
                        <p className="muted">
                          {activity.created_by_name || "System"} | {formatDateTime(activity.created_at)}
                        </p>
                        <p>{activity.note || "No note"}</p>
                      </div>
                    ))}
                    {!detailLot.activities?.length ? <p className="muted">No activity yet.</p> : null}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState compact title="No lot selected" message="Select a lot to review landed cost, approvals and stock impact." />
            )}
          </section>
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="content-grid">
          <section className="panel">
            <div className="stats-grid billing-summary-grid purchase-costing-summary-grid">
              {reportCards.map((card) => (
                <StatCard key={card.label} title={card.label} value={card.value} />
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <h3>Costing Report Snapshot</h3>
            </div>
            <div className="mini-list">
              {(purchaseCostingReports.product_wise_landed_cost || []).slice(0, 12).map((row, index) => (
                <div key={`${row.product_name}-${index}`} className="timeline-item">
                  <strong>{row.product_name}</strong>
                  <p className="muted">
                    Avg Landed {formatCurrency(row.average_landed_cost)} | Avg Real {formatCurrency(row.average_real_cost || 0)} | Avg Overhead {formatCurrency(row.average_overhead_cost || 0)}
                  </p>
                  <p>
                    Final Business {formatCurrency(row.average_final_business_cost || 0)} | Minimum {formatCurrency(row.minimum_allowed_rate)} | Suggested {formatCurrency(row.suggested_selling_rate)}
                  </p>
                </div>
              ))}
              {!(purchaseCostingReports.product_wise_landed_cost || []).length ? (
                <p className="muted">No purchase costing reports yet.</p>
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "approval" ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <h3>Approval Queue</h3>
              <p className="muted">{approvalLots.length} lots waiting for costing review or approval.</p>
            </div>
          </div>
          <div className="mini-list">
            {approvalLots.map((lot) => (
              <LotCard
                key={`approval-${lot.id}`}
                lot={lot}
                selected={selectedPurchaseLot?.id === lot.id}
                onSelect={() => handleOpenPurchaseLotDetail(lot.id)}
                onEdit={() => startEditingPurchaseCostingLot(lot)}
                onApprove={() => handleApprovePurchaseLot(lot)}
                onCancel={() => handleCancelPurchaseLot(lot)}
                canApprove={canApprove}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
              />
            ))}
            {!approvalLots.length ? <EmptyState compact title="Approval queue is clear" message="No purchase lots are waiting for review right now." /> : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
