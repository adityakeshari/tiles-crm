import express from "express";
import { pool, query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validatePurchaseCostingPayload } from "../utils/validation.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 60;
const MAX_LIST_LIMIT = 250;

function parseListLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateInterestCost(lot) {
  const override = lot.manual_interest_override ?? lot.interest_cost_override;

  if (override !== null && typeof override !== "undefined") {
    return roundMoney(override);
  }

  const financedAmount = Number(lot.financed_amount || 0);
  const rate = Number(lot.interest_rate_percent || 0);
  const holdingDays = Number(lot.holding_days || 0);
  return roundMoney((financedAmount * rate * holdingDays) / 36500);
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

function getTimeDecayPercent(lot) {
  if (lot.time_decay_percent !== null && typeof lot.time_decay_percent !== "undefined") {
    return roundMoney(lot.time_decay_percent);
  }

  const holdingDays = Number(lot.holding_days || 0);

  if (holdingDays > 180) return 6;
  if (holdingDays > 90) return 4;
  if (holdingDays > 60) return 2;
  if (holdingDays > 30) return 1;
  return 0;
}

function normalizeAllocationMethod(value) {
  const method = String(value || "").toLowerCase();

  if (method === "by_value") return "purchase_value_wise";
  if (method === "by_quantity") return "quantity_wise";
  return method || "weight_wise";
}

function normalizeOverheadAllocationMethod(value) {
  const method = String(value || "").toLowerCase();

  if (method === "per_box" || method === "per_sqft" || method === "sales_value_wise" || method === "quantity_wise") {
    return method;
  }

  return "per_box";
}

function toMonthBounds(inputDate) {
  const base = inputDate ? new Date(inputDate) : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const year = safeBase.getUTCFullYear();
  const month = safeBase.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

function mapMonthlyExpenseOverhead(row) {
  const category = String(row?.category || "").trim().toLowerCase();
  const amount = Number(row?.amount || 0);

  if (!amount) {
    return 0;
  }

  const includedCategories = new Set([
    "salary",
    "staff salary",
    "electricity",
    "internet",
    "fuel",
    "transport",
    "marketing",
    "miscellaneous",
    "showroom misc",
    "rent",
    "emi",
    "interest",
    "other",
  ]);

  return includedCategories.has(category) ? amount : 0;
}

async function fetchMonthlyOverheadSnapshot(client, lot) {
  const monthBounds = toMonthBounds(lot.stock_received_date || lot.arrival_date);
  const allocationMethod = normalizeOverheadAllocationMethod(lot.monthly_overhead_allocation_method);
  const [expenseResult, salesBasisResult] = await Promise.all([
    client.query(
      `SELECT LOWER(TRIM(category)) AS category, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM expenses
       WHERE expense_date >= $1::date AND expense_date < $2::date
       GROUP BY LOWER(TRIM(category))`,
      [monthBounds.from, monthBounds.to]
    ),
    client.query(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN LOWER(COALESCE(ii.unit, '')) IN ('box', 'boxes') THEN ii.quantity
             WHEN COALESCE(p.pieces_per_box, 0) > 0 THEN ii.quantity / NULLIF(p.pieces_per_box, 0)
             ELSE 0
           END
         ), 0)::numeric AS sold_boxes,
         COALESCE(SUM(
           CASE
             WHEN LOWER(COALESCE(ii.unit, '')) IN ('sqft', 'square feet', 'square_feet') THEN ii.quantity
             WHEN LOWER(COALESCE(ii.unit, '')) IN ('box', 'boxes') THEN ii.quantity * COALESCE(p.sqft_per_box, 0)
             WHEN COALESCE(p.pieces_per_box, 0) > 0 THEN (ii.quantity / NULLIF(p.pieces_per_box, 0)) * COALESCE(p.sqft_per_box, 0)
             ELSE 0
           END
         ), 0)::numeric AS sold_sqft,
         COALESCE(SUM(ii.quantity), 0)::numeric AS sold_quantity,
         COALESCE(SUM(ii.total), 0)::numeric AS sales_value
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       LEFT JOIN products p ON p.id = ii.product_id
       WHERE i.status = 'approved'
         AND i.invoice_date >= $1::date
         AND i.invoice_date < $2::date`,
      [monthBounds.from, monthBounds.to]
    ),
  ]);

  const monthlyOverhead = roundMoney(expenseResult.rows.reduce((sum, row) => sum + mapMonthlyExpenseOverhead(row), 0));
  const salesBasis = salesBasisResult.rows[0] || {};
  const monthlySalesBoxes = roundMoney(salesBasis.sold_boxes || 0);
  const monthlySalesSqft = roundMoney(salesBasis.sold_sqft || 0);
  const monthlySalesQuantity = roundMoney(salesBasis.sold_quantity || 0);
  const monthlySalesValue = roundMoney(salesBasis.sales_value || 0);

  let denominator = 0;
  if (allocationMethod === "per_sqft") {
    denominator = monthlySalesSqft;
  } else if (allocationMethod === "quantity_wise") {
    denominator = monthlySalesQuantity;
  } else if (allocationMethod === "sales_value_wise") {
    denominator = monthlySalesValue;
  } else {
    denominator = monthlySalesBoxes;
  }

  const monthlyOverheadRate = denominator > 0 ? roundMoney(monthlyOverhead / denominator) : 0;
  const warning =
    monthlyOverhead > 0 && denominator <= 0
      ? "Overhead not calculated because monthly sales basis is zero."
      : "";

  return {
    overheadPeriod: monthBounds.label,
    monthlyOverhead,
    allocationMethod,
    monthlySalesBoxes,
    monthlySalesSqft,
    monthlySalesQuantity,
    monthlySalesValue,
    monthlyOverheadRate,
    warning,
  };
}

function calculateCosting(lot, monthlyOverheadSnapshot = null) {
  const minimumMarginPercent = Number(lot.minimum_margin_percent || 0);
  const targetMarginPercent = Number(lot.target_margin_percent || 0);
  const interestCost = calculateInterestCost(lot);
  const timeDecayPercent = getTimeDecayPercent(lot);
  const allocationMethod = normalizeAllocationMethod(lot.allocation_method);
  const overheadSnapshot = monthlyOverheadSnapshot || {
    overheadPeriod: normalizeText(lot.overhead_period),
    monthlyOverhead: 0,
    allocationMethod: normalizeOverheadAllocationMethod(lot.monthly_overhead_allocation_method),
    monthlySalesBoxes: 0,
    monthlySalesSqft: 0,
    monthlySalesQuantity: 0,
    monthlySalesValue: 0,
    monthlyOverheadRate: 0,
    warning: "",
  };
  const charges = {
    freight: Number(lot.total_freight_cost || 0),
    unloading: Number(lot.total_unloading_cost || 0),
    interest: interestCost,
    overhead: Number(lot.showroom_overhead_amount || 0),
    other: Number(lot.other_charges || 0),
    marketing: Number(lot.marketing_cost_amount || 0),
  };

  const flatItems = [];
  (lot.suppliers || []).forEach((supplier, supplierIndex) => {
    (supplier.items || []).forEach((item, itemIndex) => {
      const purchaseValue = Number(item.quantity || 0) * Number(item.basic_purchase_rate || 0);
      const quantity = Number(item.quantity || 0);
      const damageQuantity = Number(item.damage_quantity || 0);
      const unit = String(item.unit || "pcs").toLowerCase();
      const boxes =
        Number(item.boxes || 0) > 0
          ? Number(item.boxes || 0)
          : unit === "box" || unit === "boxes"
            ? quantity
            : 0;
      const piecesPerBox = Number(item.pieces_per_box || 0);
      const sqftPerBox = Number(item.sqft_per_box || 0);
      const weightPerBox = Number(item.weight_per_box || 0);
      const weightPerUnit = Number(item.weight_per_unit || 0);
      const itemSqft =
        boxes > 0 && sqftPerBox > 0
          ? roundMoney(boxes * sqftPerBox)
          : unit === "sqft" || unit === "square feet" || unit === "square_feet"
            ? roundMoney(quantity)
            : boxes <= 0 && piecesPerBox > 0 && sqftPerBox > 0
              ? roundMoney((quantity / piecesPerBox) * sqftPerBox)
              : 0;
      const totalWeightKg =
        boxes > 0 && weightPerBox > 0
          ? roundMoney(boxes * weightPerBox)
          : weightPerUnit > 0
            ? roundMoney(quantity * weightPerUnit)
            : 0;
      const categoryMargin = getCategorySafetyMargin(item.category);
      const growthMargin = getCategoryGrowthMargin(item.category);
      const effectiveSafetyMargin =
        minimumMarginPercent > 0 ? minimumMarginPercent : Number(item.safety_margin_percent || categoryMargin);
      const effectiveGrowthMargin =
        targetMarginPercent > 0 ? targetMarginPercent : Number(item.growth_margin_percent || growthMargin);

      flatItems.push({
        ...item,
        supplier_name: supplier.supplier_name,
        supplier_amount: supplier.supplier_amount,
        supplier_index: supplierIndex,
        item_index: itemIndex,
        purchase_value: roundMoney(purchaseValue),
        damage_decay_percent: quantity > 0 ? roundMoney((damageQuantity / quantity) * 100) : 0,
        net_usable_quantity: roundMoney(Math.max(quantity - damageQuantity, 0)),
        boxes: roundMoney(boxes),
        pieces_per_box: roundMoney(piecesPerBox),
        sqft_per_box: roundMoney(sqftPerBox),
        item_sqft: itemSqft,
        weight_per_box: roundMoney(weightPerBox),
        weight_per_unit: roundMoney(weightPerUnit),
        total_weight_kg: totalWeightKg,
        safety_margin_percent: effectiveSafetyMargin,
        growth_margin_percent: effectiveGrowthMargin,
      });
    });
  });

  const totalPurchaseValue = flatItems.reduce((sum, item) => sum + Number(item.purchase_value || 0), 0);
  const totalQuantity = flatItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalSupplierAmount = flatItems.reduce((sum, item) => sum + Number(item.supplier_amount || item.purchase_value || 0), 0);
  const totalManualBase = flatItems.reduce((sum, item) => sum + Number(item.manual_allocation_value || 0), 0);
  const totalWeightKg = flatItems.reduce((sum, item) => sum + Number(item.total_weight_kg || 0), 0);
  const freightPerKg = totalWeightKg > 0 ? roundMoney(charges.freight / totalWeightKg) : 0;

  const items = flatItems.map((item) => {
    const weightBasedFreight =
      allocationMethod === "weight_wise" && Number(item.total_weight_kg || 0) > 0 && totalWeightKg > 0
        ? roundMoney(Number(item.total_weight_kg || 0) * freightPerKg)
        : null;

    const base =
      allocationMethod === "quantity_wise"
        ? Number(item.quantity || 0)
        : allocationMethod === "manual"
          ? Number(item.manual_allocation_value || 0)
          : allocationMethod === "supplier_amount_wise"
            ? Number(item.supplier_amount || item.purchase_value || 0)
            : Number(item.purchase_value || 0);

    const denominator =
      allocationMethod === "quantity_wise"
        ? totalQuantity || 1
        : allocationMethod === "manual"
          ? totalManualBase || totalPurchaseValue || 1
          : allocationMethod === "supplier_amount_wise"
            ? totalSupplierAmount || totalPurchaseValue || 1
            : totalPurchaseValue || 1;

    const share = denominator > 0 ? base / denominator : 0;
    const fallbackFreight = roundMoney(charges.freight * share);
    const allocated_freight = weightBasedFreight ?? fallbackFreight;
    const allocated_unloading = roundMoney(charges.unloading * share);
    const allocated_interest = roundMoney(charges.interest * share);
    const allocated_showroom_overhead = roundMoney(charges.overhead * share);
    const allocated_other_charges = roundMoney(charges.other * share);
    const allocated_marketing_cost = roundMoney(charges.marketing * share);
    const final_landed_cost = roundMoney(
      Number(item.purchase_value || 0) +
        allocated_freight +
        allocated_unloading +
        allocated_showroom_overhead +
        allocated_other_charges
    );
    const time_decay_cost = roundMoney(final_landed_cost * (timeDecayPercent / 100));
    const real_cost = roundMoney(final_landed_cost + allocated_interest + time_decay_cost + allocated_marketing_cost);
    const overheadBasis =
      overheadSnapshot.allocationMethod === "per_sqft"
        ? Number(item.item_sqft || 0)
        : overheadSnapshot.allocationMethod === "quantity_wise"
          ? Number(item.quantity || 0)
          : overheadSnapshot.allocationMethod === "sales_value_wise"
            ? Number(item.purchase_value || 0)
            : Number(item.boxes || 0);
    const allocated_monthly_overhead = roundMoney(overheadBasis * Number(overheadSnapshot.monthlyOverheadRate || 0));
    const final_business_cost = roundMoney(real_cost + allocated_monthly_overhead);
    const landed_cost_per_unit =
      Number(item.net_usable_quantity || 0) > 0
        ? roundMoney(final_landed_cost / Number(item.net_usable_quantity))
        : 0;
    const real_cost_per_unit =
      Number(item.net_usable_quantity || 0) > 0
        ? roundMoney(real_cost / Number(item.net_usable_quantity))
        : 0;
    const overhead_cost_per_unit =
      Number(item.net_usable_quantity || 0) > 0
        ? roundMoney(allocated_monthly_overhead / Number(item.net_usable_quantity))
        : 0;
    const final_business_cost_per_unit =
      Number(item.net_usable_quantity || 0) > 0
        ? roundMoney(final_business_cost / Number(item.net_usable_quantity))
        : 0;
    const minimum_allowed_rate = roundMoney(
      real_cost_per_unit + real_cost_per_unit * (Number(item.safety_margin_percent || 0) / 100)
    );
    const suggested_selling_rate = roundMoney(
      minimum_allowed_rate + minimum_allowed_rate * (Number(item.growth_margin_percent || 0) / 100)
    );
    const weightWarning =
      allocationMethod === "weight_wise" && !(Number(item.total_weight_kg || 0) > 0)
        ? "Weight missing - freight fallback to purchase value."
        : "";

    return {
      ...item,
      allocated_freight,
      allocated_unloading,
      allocated_interest,
      allocated_showroom_overhead,
      allocated_other_charges,
      allocated_time_decay: time_decay_cost,
      allocated_marketing_cost,
      final_landed_cost,
      real_cost,
      allocated_monthly_overhead,
      final_business_cost,
      landed_cost_per_unit,
      real_cost_per_unit,
      overhead_cost_per_unit,
      final_business_cost_per_unit,
      minimum_allowed_rate,
      suggested_selling_rate,
      time_decay_percent: roundMoney(timeDecayPercent),
      weight_warning: weightWarning,
      overhead_warning: overheadSnapshot.warning,
    };
  });

  const suppliers = (lot.suppliers || []).map((supplier, supplierIndex) => {
    const supplierItems = items.filter((item) => item.supplier_index === supplierIndex);
    const derivedAmount = roundMoney(
      supplierItems.reduce((sum, item) => sum + Number(item.purchase_value || 0), 0)
    );

    return {
      ...supplier,
      supplier_amount:
        supplier.supplier_amount !== null && typeof supplier.supplier_amount !== "undefined"
          ? roundMoney(supplier.supplier_amount)
          : derivedAmount,
      items: supplierItems,
    };
  });

  return {
    interest_cost: interestCost,
    calculated_interest_cost: interestCost,
    time_decay_percent: roundMoney(timeDecayPercent),
    total_purchase_value: roundMoney(totalPurchaseValue),
    total_net_usable_quantity: roundMoney(
      items.reduce((sum, item) => sum + Number(item.net_usable_quantity || 0), 0)
    ),
    total_truck_weight_kg: roundMoney(totalWeightKg),
    freight_per_kg: roundMoney(freightPerKg),
    total_real_cost: roundMoney(items.reduce((sum, item) => sum + Number(item.real_cost || 0), 0)),
    total_final_business_cost: roundMoney(items.reduce((sum, item) => sum + Number(item.final_business_cost || 0), 0)),
    missing_weight_items_count: items.filter((item) => item.weight_warning).length,
    monthly_overhead_amount: roundMoney(overheadSnapshot.monthlyOverhead),
    monthly_overhead_allocation_method: overheadSnapshot.allocationMethod,
    monthly_sales_boxes: roundMoney(overheadSnapshot.monthlySalesBoxes),
    monthly_sales_sqft: roundMoney(overheadSnapshot.monthlySalesSqft),
    monthly_sales_quantity: roundMoney(overheadSnapshot.monthlySalesQuantity),
    monthly_sales_value: roundMoney(overheadSnapshot.monthlySalesValue),
    monthly_overhead_rate: roundMoney(overheadSnapshot.monthlyOverheadRate),
    overhead_warning: overheadSnapshot.warning,
    items,
    suppliers,
    charge_rows: [
      { charge_type: "freight", amount: roundMoney(charges.freight), notes: "Lot freight allocation" },
      { charge_type: "unloading", amount: roundMoney(charges.unloading), notes: "Lot unloading allocation" },
      { charge_type: "interest", amount: roundMoney(charges.interest), notes: "Bank interest / finance cost" },
      { charge_type: "overhead", amount: roundMoney(charges.overhead), notes: lot.overhead_notes || "Showroom overhead allocation" },
      { charge_type: "time_decay", amount: roundMoney(items.reduce((sum, item) => sum + Number(item.allocated_time_decay || 0), 0)), notes: "Holding / time decay cost" },
      { charge_type: "marketing", amount: roundMoney(charges.marketing), notes: "Marketing / sales push cost" },
      { charge_type: "other", amount: roundMoney(charges.other), notes: "Other landed charges" },
    ],
  };
}

async function logLotActivity(client, lotId, action, createdBy, note = "") {
  await client.query(
    `INSERT INTO purchase_lot_activity_logs (lot_id, action, note, created_by)
     VALUES ($1, $2, $3, $4)`,
    [lotId, action, note, createdBy]
  );
}

async function fetchLotDetail(client, lotId) {
  const [lotResult, suppliersResult, itemsResult, chargesResult, activitiesResult] = await Promise.all([
    client.query(
      `SELECT
         l.*,
         created_user.name AS created_by_user_name,
         approved_user.name AS approved_by_user_name,
         cancelled_user.name AS cancelled_by_user_name
       FROM purchase_lots l
       LEFT JOIN users created_user ON created_user.id = l.created_by
       LEFT JOIN users approved_user ON approved_user.id = l.approved_by
       LEFT JOIN users cancelled_user ON cancelled_user.id = l.cancelled_by
       WHERE l.id = $1
       LIMIT 1`,
      [lotId]
    ),
    client.query(
      `SELECT *
       FROM purchase_lot_suppliers
       WHERE lot_id = $1
       ORDER BY id ASC`,
      [lotId]
    ),
    client.query(
      `SELECT i.*, p.name AS product_name_master
       FROM purchase_lot_items i
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.lot_id = $1
       ORDER BY i.supplier_id ASC, i.id ASC`,
      [lotId]
    ),
    client.query(
      `SELECT *
       FROM purchase_lot_charges
       WHERE lot_id = $1
       ORDER BY id ASC`,
      [lotId]
    ),
    client.query(
      `SELECT a.*, u.name AS created_by_name
       FROM purchase_lot_activity_logs a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.lot_id = $1
       ORDER BY a.created_at DESC, a.id DESC`,
      [lotId]
    ),
  ]);

  if (!lotResult.rowCount) {
    return null;
  }

  const suppliers = suppliersResult.rows.map((supplier) => ({
    ...supplier,
    items: itemsResult.rows.filter((item) => item.supplier_id === supplier.id),
  }));

  return {
    ...lotResult.rows[0],
    suppliers,
    items: itemsResult.rows,
    charges: chargesResult.rows,
    activities: activitiesResult.rows,
  };
}

async function applyLotInventory(client, lotDetail, direction) {
  for (const item of lotDetail.items || []) {
    if (!item.product_id) {
      continue;
    }

    const netUsableQuantity = Math.max(Math.round(Number(item.net_usable_quantity || 0)), 0);
    if (!netUsableQuantity) {
      continue;
    }

    if (direction > 0) {
      await client.query(
        `UPDATE products
         SET stock_sqft = stock_sqft + $1,
             last_purchase_rate = $2,
             landed_cost_per_unit = $3,
             minimum_allowed_rate = $4,
             real_cost_per_unit = $5,
             overhead_cost_per_unit = $6,
             final_business_cost_per_unit = $7,
             suggested_selling_rate = CASE WHEN pricing_lock THEN suggested_selling_rate ELSE $8 END,
             cost_updated_at = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [
          netUsableQuantity,
          roundMoney(item.basic_purchase_rate),
          roundMoney(item.landed_cost_per_unit),
          roundMoney(item.minimum_allowed_rate),
          roundMoney(item.real_cost_per_unit),
          roundMoney(item.overhead_cost_per_unit || 0),
          roundMoney(item.final_business_cost_per_unit || 0),
          roundMoney(item.suggested_selling_rate),
          item.product_id,
        ]
      );
    } else {
      await client.query(
        `UPDATE products
         SET stock_sqft = GREATEST(stock_sqft - $1, 0),
             cost_updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [netUsableQuantity, item.product_id]
      );
    }
  }
}

async function replaceLotChildren(client, lotId, lotPayload, costing) {
  await client.query("DELETE FROM purchase_lot_items WHERE lot_id = $1", [lotId]);
  await client.query("DELETE FROM purchase_lot_suppliers WHERE lot_id = $1", [lotId]);
  await client.query("DELETE FROM purchase_lot_charges WHERE lot_id = $1", [lotId]);

  const supplierIdMap = new Map();

  for (let index = 0; index < costing.suppliers.length; index += 1) {
    const supplier = costing.suppliers[index];
    const supplierResult = await client.query(
      `INSERT INTO purchase_lot_suppliers (
         lot_id, supplier_name, supplier_invoice_number, supplier_invoice_date, supplier_amount, supplier_notes
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        lotId,
        supplier.supplier_name,
        supplier.supplier_invoice_number,
        supplier.supplier_invoice_date,
        supplier.supplier_amount,
        supplier.supplier_notes,
      ]
    );
    supplierIdMap.set(index, supplierResult.rows[0].id);
  }

  for (const item of costing.items) {
    await client.query(
      `INSERT INTO purchase_lot_items (
         lot_id, supplier_id, product_id, item_name, category, quantity, unit, basic_purchase_rate,
         company_name, product_size, boxes, pieces_per_box, sqft_per_box, weight_per_box, weight_per_unit, total_weight_kg,
         purchase_value, damage_quantity, damage_decay_percent, net_usable_quantity,
         allocated_freight, allocated_unloading, allocated_interest, allocated_showroom_overhead,
         allocated_monthly_overhead, allocated_other_charges, allocated_time_decay, allocated_marketing_cost,
         final_landed_cost, real_cost, final_business_cost, landed_cost_per_unit, real_cost_per_unit, overhead_cost_per_unit,
         final_business_cost_per_unit, minimum_allowed_rate, suggested_selling_rate, overhead_warning, manual_allocation_value
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)`,
      [
        lotId,
        supplierIdMap.get(item.supplier_index),
        item.product_id,
        item.item_name,
        item.category,
        item.quantity,
        item.unit,
        item.basic_purchase_rate,
        item.company_name || "",
        item.product_size || "",
        item.boxes || 0,
        item.pieces_per_box || 0,
        item.sqft_per_box || 0,
        item.weight_per_box || 0,
        item.weight_per_unit || 0,
        item.total_weight_kg || 0,
        item.purchase_value,
        item.damage_quantity,
        item.damage_decay_percent,
        item.net_usable_quantity,
        item.allocated_freight,
        item.allocated_unloading,
        item.allocated_interest,
        item.allocated_showroom_overhead,
        item.allocated_monthly_overhead || 0,
        item.allocated_other_charges,
        item.allocated_time_decay || 0,
        item.allocated_marketing_cost || 0,
        item.final_landed_cost,
        item.real_cost || 0,
        item.final_business_cost || 0,
        item.landed_cost_per_unit,
        item.real_cost_per_unit || 0,
        item.overhead_cost_per_unit || 0,
        item.final_business_cost_per_unit || 0,
        item.minimum_allowed_rate,
        item.suggested_selling_rate,
        item.overhead_warning || "",
        item.manual_allocation_value || 0,
      ]
    );
  }

  for (const charge of costing.charge_rows) {
    if (Number(charge.amount || 0) <= 0) {
      continue;
    }

    await client.query(
      `INSERT INTO purchase_lot_charges (lot_id, charge_type, amount, notes)
       VALUES ($1, $2, $3, $4)`,
      [lotId, charge.charge_type, charge.amount, charge.notes]
    );
  }
}

router.get(
  "/",
  requireRole("admin", "manager", "inventory", "accounts", "operator", "reports"),
  async (req, res) => {
    const limit = parseListLimit(req.query.limit);
    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status);

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(l.lot_number ILIKE $${params.length} OR l.vehicle_number ILIKE $${params.length} OR l.transporter_name ILIKE $${params.length})`
      );
    }

    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    try {
      const [
        lotsResult,
        summaryResult,
        lotCostingResult,
        supplierCostResult,
        productCostResult,
        damageReportResult,
        freightReportResult,
        timeDecayReportResult,
        interestBurdenReportResult,
        lowMarginResult,
        productsResult,
      ] = await Promise.all([
        query(
          `SELECT
             l.id,
             l.lot_number,
             l.arrival_date,
             l.vehicle_number,
             l.transporter_name,
             l.status,
             l.total_purchase_value,
             l.total_net_usable_quantity,
             l.total_freight_cost,
           l.total_unloading_cost,
           l.interest_cost,
           l.showroom_overhead_amount,
           l.monthly_overhead_amount,
           l.monthly_overhead_allocation_method,
           l.monthly_sales_boxes,
           l.monthly_sales_sqft,
           l.monthly_sales_quantity,
           l.monthly_sales_value,
           l.monthly_overhead_rate,
           l.marketing_cost_amount,
           l.time_decay_percent,
           l.total_truck_weight_kg,
           l.freight_per_kg,
            l.other_charges,
            l.minimum_margin_percent,
            l.target_margin_percent,
            l.total_final_business_cost,
             l.stock_applied,
             created_user.name AS created_by_user_name,
             approved_user.name AS approved_by_user_name
           FROM purchase_lots l
           LEFT JOIN users created_user ON created_user.id = l.created_by
           LEFT JOIN users approved_user ON approved_user.id = l.approved_by
           ${where}
           ORDER BY l.arrival_date DESC, l.id DESC
           LIMIT $${params.length}`,
          params
        ),
        query(
          `SELECT
             COUNT(*)::int AS total_lots,
             COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_lots,
             COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_lots,
             COALESCE(SUM(total_purchase_value), 0)::numeric AS total_purchase_value,
             COALESCE(SUM(total_freight_cost), 0)::numeric AS total_freight_cost,
             COALESCE(SUM(total_unloading_cost), 0)::numeric AS total_unloading_cost,
             COALESCE(SUM(total_freight_cost + total_unloading_cost + interest_cost + showroom_overhead_amount + other_charges + marketing_cost_amount + time_decay_cost), 0)::numeric AS total_allocated_charges,
             COALESCE(SUM(total_net_usable_quantity), 0)::numeric AS total_net_usable_quantity,
             COALESCE(SUM(total_truck_weight_kg), 0)::numeric AS total_truck_weight_kg,
             COALESCE(SUM(total_real_cost), 0)::numeric AS total_real_cost,
             COALESCE(SUM(monthly_overhead_amount), 0)::numeric AS monthly_overhead_amount,
             COALESCE(SUM(monthly_sales_boxes), 0)::numeric AS monthly_sales_boxes,
             COALESCE(SUM(monthly_sales_sqft), 0)::numeric AS monthly_sales_sqft,
             COALESCE(SUM(monthly_sales_quantity), 0)::numeric AS monthly_sales_quantity,
             COALESCE(SUM(monthly_sales_value), 0)::numeric AS monthly_sales_value,
             COALESCE(AVG(NULLIF(monthly_overhead_rate, 0)), 0)::numeric AS monthly_overhead_rate,
             COALESCE(SUM(total_final_business_cost), 0)::numeric AS total_final_business_cost
           FROM purchase_lots`
        ),
        query(
          `SELECT lot_number, arrival_date, total_purchase_value, total_net_usable_quantity, status
           FROM purchase_lots
           ORDER BY arrival_date DESC, id DESC
           LIMIT 15`
        ),
        query(
          `SELECT supplier_name,
                  COUNT(*)::int AS lot_count,
                  COALESCE(SUM(supplier_amount), 0)::numeric AS supplier_total
           FROM purchase_lot_suppliers
           GROUP BY supplier_name
           ORDER BY supplier_total DESC
           LIMIT 20`
        ),
        query(
          `SELECT item_name,
                  product_id,
                  COALESCE(AVG(landed_cost_per_unit), 0)::numeric AS average_landed_cost,
                  COALESCE(AVG(real_cost_per_unit), 0)::numeric AS average_real_cost,
                  COALESCE(AVG(overhead_cost_per_unit), 0)::numeric AS average_overhead_cost,
                  COALESCE(AVG(final_business_cost_per_unit), 0)::numeric AS average_final_business_cost,
                  COALESCE(MAX(suggested_selling_rate), 0)::numeric AS suggested_selling_rate,
                  COALESCE(MAX(minimum_allowed_rate), 0)::numeric AS minimum_allowed_rate
           FROM purchase_lot_items
           GROUP BY item_name, product_id
           ORDER BY average_landed_cost DESC
           LIMIT 25`
        ),
        query(
          `SELECT item_name,
                  COALESCE(SUM(damage_quantity), 0)::numeric AS total_damage_quantity,
                  COALESCE(AVG(damage_decay_percent), 0)::numeric AS avg_damage_percent
           FROM purchase_lot_items
           GROUP BY item_name
           HAVING COALESCE(SUM(damage_quantity), 0) > 0
           ORDER BY total_damage_quantity DESC
           LIMIT 20`
        ),
        query(
          `SELECT item_name,
                  COALESCE(SUM(total_weight_kg), 0)::numeric AS total_weight_kg,
                  COALESCE(SUM(allocated_freight), 0)::numeric AS freight_total,
                  COALESCE(SUM(allocated_unloading), 0)::numeric AS unloading_total
           FROM purchase_lot_items
           GROUP BY item_name
           ORDER BY freight_total DESC
           LIMIT 20`
        ),
        query(
          `SELECT item_name,
                  COALESCE(SUM(allocated_time_decay), 0)::numeric AS total_time_decay_cost,
                  COALESCE(AVG(allocated_time_decay), 0)::numeric AS average_time_decay_cost
           FROM purchase_lot_items
           GROUP BY item_name
           HAVING COALESCE(SUM(allocated_time_decay), 0) > 0
           ORDER BY total_time_decay_cost DESC
           LIMIT 20`
        ),
        query(
          `SELECT item_name,
                  COALESCE(SUM(allocated_interest), 0)::numeric AS total_interest_cost,
                  COALESCE(AVG(allocated_interest), 0)::numeric AS average_interest_cost
           FROM purchase_lot_items
           GROUP BY item_name
           HAVING COALESCE(SUM(allocated_interest), 0) > 0
           ORDER BY total_interest_cost DESC
           LIMIT 20`
        ),
        query(
          `SELECT item_name, landed_cost_per_unit, real_cost_per_unit, minimum_allowed_rate, suggested_selling_rate
           FROM purchase_lot_items
           WHERE suggested_selling_rate <= minimum_allowed_rate OR real_cost_per_unit > minimum_allowed_rate
           ORDER BY created_at DESC
           LIMIT 20`
        ),
        query(
          `SELECT id, name, business_unit, category, stock_sqft, price_per_sqft, last_purchase_rate,
                  landed_cost_per_unit, real_cost_per_unit, overhead_cost_per_unit, final_business_cost_per_unit, minimum_allowed_rate, suggested_selling_rate,
                  company_name, product_size, pieces_per_box, sqft_per_box, weight_per_box, weight_per_unit, safety_margin_percent, growth_margin_percent, pricing_lock
           FROM products
           ORDER BY name ASC
           LIMIT 400`
        ),
      ]);

      return res.json({
        lots: lotsResult.rows,
        summary: summaryResult.rows[0] || null,
        reports: {
          lot_wise_costing: lotCostingResult.rows,
          supplier_wise_purchase_cost: supplierCostResult.rows,
          product_wise_landed_cost: productCostResult.rows,
          damage_decay_report: damageReportResult.rows,
          freight_allocation_report: freightReportResult.rows,
          time_decay_report: timeDecayReportResult.rows,
          interest_burden_report: interestBurdenReportResult.rows,
          low_margin_warning_report: lowMarginResult.rows,
        },
        references: {
          products: productsResult.rows,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch purchase costing dashboard", error: error.message });
    }
  }
);

router.get(
  "/:id",
  requireRole("admin", "manager", "inventory", "accounts", "operator", "reports"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const detail = await fetchLotDetail(client, req.params.id);

      if (!detail) {
        return res.status(404).json({ message: "Purchase lot not found" });
      }

      return res.json(detail);
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch purchase lot detail", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/",
  requireRole("admin", "manager", "inventory", "accounts", "operator"),
  async (req, res) => {
    const validation = validatePurchaseCostingPayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const lot = validation.value;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const monthlyOverheadSnapshot = await fetchMonthlyOverheadSnapshot(client, lot);
      const costing = calculateCosting(lot, monthlyOverheadSnapshot);
      const insertResult = await client.query(
        `INSERT INTO purchase_lots (
           lot_number, arrival_date, vehicle_number, transporter_name, driver_name, driver_mobile,
           allocation_method, total_freight_cost, total_unloading_cost, other_charges, financed_amount,
           interest_rate_percent, holding_days, stock_received_date, interest_cost_override, interest_cost, calculated_interest_cost,
           showroom_overhead_amount, monthly_overhead_amount, monthly_overhead_allocation_method, monthly_sales_boxes,
           monthly_sales_sqft, monthly_sales_quantity, monthly_sales_value, monthly_overhead_rate,
           overhead_period, overhead_notes, time_decay_percent, time_decay_cost,
           marketing_cost_amount, marketing_cost_allocation_method,
           minimum_margin_percent, target_margin_percent, total_purchase_value,
           total_net_usable_quantity, total_truck_weight_kg, freight_per_kg, total_real_cost, total_final_business_cost,
           remarks, status, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43)
         RETURNING id`,
        [
          lot.lot_number,
          lot.arrival_date,
          lot.vehicle_number,
          lot.transporter_name,
          lot.driver_name,
          lot.driver_mobile,
          lot.allocation_method,
          lot.total_freight_cost,
          lot.total_unloading_cost,
          lot.other_charges,
          lot.financed_amount,
          lot.interest_rate_percent,
          lot.holding_days,
          lot.stock_received_date,
          lot.interest_cost_override,
          costing.interest_cost,
          costing.calculated_interest_cost,
          lot.showroom_overhead_amount,
          costing.monthly_overhead_amount,
          costing.monthly_overhead_allocation_method,
          costing.monthly_sales_boxes,
          costing.monthly_sales_sqft,
          costing.monthly_sales_quantity,
          costing.monthly_sales_value,
          costing.monthly_overhead_rate,
          lot.overhead_period || monthlyOverheadSnapshot.overheadPeriod,
          lot.overhead_notes,
          costing.time_decay_percent,
          roundMoney(costing.items.reduce((sum, item) => sum + Number(item.allocated_time_decay || 0), 0)),
          lot.marketing_cost_amount || 0,
          lot.marketing_cost_allocation_method || "manual",
          lot.minimum_margin_percent,
          lot.target_margin_percent,
          costing.total_purchase_value,
          costing.total_net_usable_quantity,
          costing.total_truck_weight_kg,
          costing.freight_per_kg,
          costing.total_real_cost,
          costing.total_final_business_cost,
          lot.remarks,
          lot.status === "approved" ? "cost_calculated" : lot.status,
          req.user.id,
          req.user.id,
        ]
      );

      const lotId = insertResult.rows[0].id;
      await replaceLotChildren(client, lotId, lot, costing);
      await logLotActivity(client, lotId, "created", req.user.id, "Purchase lot created.");
      await logLotActivity(client, lotId, "cost_calculated", req.user.id, "Landed costing calculated.");

      await client.query("COMMIT");
      const detail = await fetchLotDetail(client, lotId);
      return res.status(201).json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to create purchase lot", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id",
  requireRole("admin", "manager", "inventory", "accounts", "operator"),
  async (req, res) => {
    const validation = validatePurchaseCostingPayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const lot = validation.value;
    const lotId = Number(req.params.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const existing = await fetchLotDetail(client, lotId);

      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Purchase lot not found" });
      }

      if (existing.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Cancelled purchase lot cannot be edited" });
      }

      const monthlyOverheadSnapshot = await fetchMonthlyOverheadSnapshot(client, lot);
      const costing = calculateCosting(lot, monthlyOverheadSnapshot);

      await client.query(
        `UPDATE purchase_lots
         SET lot_number = $1,
             arrival_date = $2,
             vehicle_number = $3,
             transporter_name = $4,
             driver_name = $5,
             driver_mobile = $6,
             allocation_method = $7,
             total_freight_cost = $8,
             total_unloading_cost = $9,
             other_charges = $10,
             financed_amount = $11,
             interest_rate_percent = $12,
             holding_days = $13,
             stock_received_date = $14,
             interest_cost_override = $15,
             interest_cost = $16,
             calculated_interest_cost = $17,
             showroom_overhead_amount = $18,
             monthly_overhead_amount = $19,
             monthly_overhead_allocation_method = $20,
             monthly_sales_boxes = $21,
             monthly_sales_sqft = $22,
             monthly_sales_quantity = $23,
             monthly_sales_value = $24,
             monthly_overhead_rate = $25,
             overhead_period = $26,
             overhead_notes = $27,
             time_decay_percent = $28,
             time_decay_cost = $29,
             marketing_cost_amount = $30,
             marketing_cost_allocation_method = $31,
             minimum_margin_percent = $32,
             target_margin_percent = $33,
             total_purchase_value = $34,
             total_net_usable_quantity = $35,
             total_truck_weight_kg = $36,
             freight_per_kg = $37,
             total_real_cost = $38,
             total_final_business_cost = $39,
             remarks = $40,
             status = CASE WHEN status = 'approved' THEN 'approved' ELSE 'cost_calculated' END,
             updated_by = $41,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $42`,
        [
          lot.lot_number,
          lot.arrival_date,
          lot.vehicle_number,
          lot.transporter_name,
          lot.driver_name,
          lot.driver_mobile,
          lot.allocation_method,
          lot.total_freight_cost,
          lot.total_unloading_cost,
          lot.other_charges,
          lot.financed_amount,
          lot.interest_rate_percent,
          lot.holding_days,
          lot.stock_received_date,
          lot.interest_cost_override,
          costing.interest_cost,
          costing.calculated_interest_cost,
          lot.showroom_overhead_amount,
          costing.monthly_overhead_amount,
          costing.monthly_overhead_allocation_method,
          costing.monthly_sales_boxes,
          costing.monthly_sales_sqft,
          costing.monthly_sales_quantity,
          costing.monthly_sales_value,
          costing.monthly_overhead_rate,
          lot.overhead_period || monthlyOverheadSnapshot.overheadPeriod,
          lot.overhead_notes,
          costing.time_decay_percent,
          roundMoney(costing.items.reduce((sum, item) => sum + Number(item.allocated_time_decay || 0), 0)),
          lot.marketing_cost_amount || 0,
          lot.marketing_cost_allocation_method || "manual",
          lot.minimum_margin_percent,
          lot.target_margin_percent,
          costing.total_purchase_value,
          costing.total_net_usable_quantity,
          costing.total_truck_weight_kg,
          costing.freight_per_kg,
          costing.total_real_cost,
          costing.total_final_business_cost,
          lot.remarks,
          req.user.id,
          lotId,
        ]
      );

      await replaceLotChildren(client, lotId, lot, costing);
      await logLotActivity(client, lotId, "updated", req.user.id, "Purchase lot updated.");
      await logLotActivity(client, lotId, "cost_calculated", req.user.id, "Landed costing recalculated.");

      if (existing.status === "approved" && existing.stock_applied) {
        await applyLotInventory(client, existing, -1);
        const refreshed = await fetchLotDetail(client, lotId);
        await applyLotInventory(client, refreshed, 1);
        await logLotActivity(client, lotId, "inventory_resynced", req.user.id, "Approved lot stock and product costing resynced after edit.");
      }

      await client.query("COMMIT");
      const detail = await fetchLotDetail(client, lotId);
      return res.json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to update purchase lot", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id/approve",
  requireRole("admin", "manager"),
  async (req, res) => {
    const lotId = Number(req.params.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const detail = await fetchLotDetail(client, lotId);

      if (!detail) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Purchase lot not found" });
      }

      if (detail.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Cancelled lot cannot be approved" });
      }

      if (!detail.stock_applied) {
        await applyLotInventory(client, detail, 1);
      }

      await client.query(
        `UPDATE purchase_lots
         SET status = 'approved',
             approved_by = $1,
             approved_at = CURRENT_TIMESTAMP,
             stock_applied = TRUE,
             updated_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.user.id, lotId]
      );

      await logLotActivity(client, lotId, "approved", req.user.id, "Purchase lot approved and stock applied.");
      await client.query("COMMIT");
      const updated = await fetchLotDetail(client, lotId);
      return res.json(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to approve purchase lot", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id/cancel",
  requireRole("admin", "manager"),
  async (req, res) => {
    const lotId = Number(req.params.id);
    const note = normalizeText(req.body?.note);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const detail = await fetchLotDetail(client, lotId);

      if (!detail) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Purchase lot not found" });
      }

      if (detail.stock_applied) {
        await applyLotInventory(client, detail, -1);
      }

      await client.query(
        `UPDATE purchase_lots
         SET status = 'cancelled',
             cancelled_by = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             stock_applied = FALSE,
             updated_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.user.id, lotId]
      );

      await logLotActivity(client, lotId, "cancelled", req.user.id, note || "Purchase lot cancelled.");
      await client.query("COMMIT");
      const updated = await fetchLotDetail(client, lotId);
      return res.json(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to cancel purchase lot", error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;
