import express from "express";
import { pool, query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import {
  validateBillingApprovalPayload,
  validateBillingInvoicePayload,
  validateBillingPaymentPayload,
} from "../utils/validation.js";
import { streamBillingInvoicePdf } from "../utils/invoicePdf.js";
import { getOrSetCache, invalidateCachePrefix } from "../utils/ttlCache.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 80;
const MAX_LIST_LIMIT = 250;
const BILLING_TTL_MS = 5000;
const HIGH_DISCOUNT_PERCENT = 10;

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function derivePredefinedRate(product) {
  return toNumber(
    product?.predefined_rate || product?.suggested_selling_rate || product?.price_per_sqft || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0
  );
}

function deriveTodaySellingRate(product) {
  const predefinedRate = derivePredefinedRate(product);

  if (predefinedRate > 0) {
    const upLimitPercent = Math.max(toNumber(product?.daily_up_limit_percent, 2), 0);
    const downLimitPercent = Math.max(toNumber(product?.daily_down_limit_percent, 1), 0);
    const minRate = predefinedRate * (1 - downLimitPercent / 100);
    const maxRate = predefinedRate * (1 + upLimitPercent / 100);
    const rawRate = toNumber(product?.today_selling_rate || predefinedRate);
    return Number(clamp(rawRate > 0 ? rawRate : predefinedRate, minRate, maxRate).toFixed(2));
  }

  return toNumber(
    product?.today_selling_rate || product?.suggested_selling_rate || product?.price_per_sqft || product?.real_cost_per_unit || product?.landed_cost_per_unit || 0
  );
}

function deriveRatePolicy(product) {
  const predefinedRate = derivePredefinedRate(product);
  const todaySellingRate = deriveTodaySellingRate(product);
  const minimumAllowedRate = toNumber(product?.minimum_allowed_rate || product?.real_cost_per_unit || product?.landed_cost_per_unit || todaySellingRate || 0);
  const realCostPerUnit = toNumber(product?.real_cost_per_unit || product?.landed_cost_per_unit || 0);
  const operatorDiscountCap = Math.max(toNumber(product?.operator_discount_cap, 0), 0);
  const managerDiscountCap = Math.max(toNumber(product?.manager_discount_cap, operatorDiscountCap), operatorDiscountCap);
  const ownerDiscountCap = Math.max(toNumber(product?.owner_discount_cap, managerDiscountCap), managerDiscountCap);

  const operatorFloor = predefinedRate > 0 ? predefinedRate * (1 - operatorDiscountCap / 100) : 0;
  const managerFloor = predefinedRate > 0 ? predefinedRate * (1 - managerDiscountCap / 100) : 0;
  const ownerFloor = predefinedRate > 0 ? predefinedRate * (1 - ownerDiscountCap / 100) : 0;

  return {
    predefinedRate,
    todaySellingRate,
    minimumAllowedRate,
    realCostPerUnit,
    operatorFloor: Number(operatorFloor.toFixed(2)),
    managerFloor: Number(managerFloor.toFixed(2)),
    ownerFloor: Number(ownerFloor.toFixed(2)),
  };
}

function getDiscountApprovalReason(customerRate, policy) {
  if (customerRate <= 0) {
    return "";
  }

  if (policy.realCostPerUnit > 0 && customerRate < policy.realCostPerUnit) {
    return "owner_discount_approval";
  }

  if (policy.minimumAllowedRate > 0 && customerRate < policy.minimumAllowedRate) {
    return "owner_discount_approval";
  }

  if (policy.predefinedRate <= 0) {
    return "";
  }

  if ((policy.managerFloor > 0 && customerRate < policy.managerFloor) || (policy.ownerFloor > 0 && customerRate < policy.ownerFloor)) {
    return "owner_discount_approval";
  }

  if (policy.operatorFloor > 0 && customerRate < policy.operatorFloor) {
    return "manager_discount_approval";
  }

  return "";
}

function toInvoiceNumber(invoiceType) {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const fyLabel = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
  const prefix = invoiceType === "estimate" ? "EST" : "INV";
  return `${prefix}/${fyLabel}/${String(Date.now()).slice(-6)}`;
}

function derivePaymentStatus(grandTotal, receivedAmount) {
  if (receivedAmount <= 0) {
    return "unpaid";
  }

  if (receivedAmount >= grandTotal) {
    return "paid";
  }

  return "partial";
}

function buildApprovalReasonLabel(code) {
  switch (code) {
    case "high_discount":
      return "High discount";
    case "manager_discount_approval":
      return "Manager discount approval";
    case "owner_discount_approval":
      return "Owner discount approval";
    case "minimum_rate_breach":
      return "Customer rate below minimum";
    case "invoice_edit":
      return "Invoice edit after approval";
    case "invoice_cancellation":
      return "Invoice cancellation";
    case "payment_mismatch":
      return "Payment mismatch";
    case "price_override":
      return "Price override";
    case "invoice_deletion":
      return "Invoice deletion";
    default:
      return code;
  }
}

function buildApprovalReasonText(codes) {
  return [...new Set(codes)].map(buildApprovalReasonLabel).join(", ");
}

function normalizeSystemDiscountMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const originalTotal = toNumber(meta.original_total);
  const systemBenefitAmount = toNumber(meta.system_benefit_amount);
  const finalTotal = toNumber(meta.final_total);
  const approvalLevel = normalizeText(meta.approval_level).toLowerCase();
  const reason = normalizeText(meta.reason);

  if (systemBenefitAmount <= 0) {
    return null;
  }

  return {
    original_total: originalTotal,
    system_benefit_amount: systemBenefitAmount,
    final_total: finalTotal,
    approval_level: approvalLevel,
    reason,
  };
}

function buildSystemDiscountAuditText(meta) {
  if (!meta) {
    return "";
  }

  const levelLabel =
    meta.approval_level === "owner"
      ? "Owner approval"
      : meta.approval_level === "manager"
        ? "Manager approval"
        : "Auto approved";

  return [
    "System discount applied",
    `Original total: ${meta.original_total.toFixed(2)}`,
    `Benefit amount: ${meta.system_benefit_amount.toFixed(2)}`,
    `Final total: ${meta.final_total.toFixed(2)}`,
    `Approval level: ${levelLabel}`,
    `Reason: ${meta.reason || "System calculated bill-level benefit"}`,
  ].join(" | ");
}

function sanitizeBillingInvoicePayload(payload = {}) {
  return {
    ...payload,
    gst_amount: 0,
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          ...item,
          gst_percent: 0,
          gst: 0,
          rate: item?.customer_rate ?? item?.rate ?? 0,
        }))
      : [],
  };
}

function getMonthBounds(inputDate = new Date()) {
  const base = inputDate instanceof Date ? inputDate : new Date(inputDate);
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const year = safeBase.getUTCFullYear();
  const month = safeBase.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function includeMonthlyOverheadCategory(category) {
  const normalized = String(category || "").trim().toLowerCase();
  return new Set([
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
  ]).has(normalized);
}

async function logInvoiceActivity(client, invoiceId, action, createdBy, note = "") {
  await client.query(
    `INSERT INTO invoice_activity_logs (invoice_id, action, note, created_by)
     VALUES ($1, $2, $3, $4)`,
    [invoiceId, action, note, createdBy]
  );
}

async function getProductMap(client, items) {
  const productIds = [...new Set((items || []).map((item) => item.product_id).filter(Boolean))];

  if (!productIds.length) {
    return new Map();
  }

  const result = await client.query(
      `SELECT id, name, business_unit, stock_sqft, price_per_sqft,
            predefined_rate, today_selling_rate, daily_up_limit_percent, daily_down_limit_percent,
            landed_cost_per_unit, real_cost_per_unit, overhead_cost_per_unit, final_business_cost_per_unit,
            minimum_allowed_rate, suggested_selling_rate,
            operator_discount_cap, manager_discount_cap, owner_discount_cap, quotation_validity_days
     FROM products
     WHERE id = ANY($1::int[])`,
    [productIds]
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

function evaluateApprovalReasons(invoice, productMap, { previousStatus = "", systemDiscountMeta = null } = {}) {
  const reasons = [];
  const subtotal = toNumber(invoice.subtotal);
  const totalDiscount = toNumber(invoice.total_discount);
  const discountPercent = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;

  if (discountPercent > HIGH_DISCOUNT_PERCENT) {
    reasons.push("high_discount");
  }

  for (const item of invoice.items || []) {
    const product = item.product_id ? productMap.get(item.product_id) : null;
    const policy = deriveRatePolicy(product);
    const suggestedRate = policy.todaySellingRate;
    const minimumAllowedRate = policy.minimumAllowedRate;
    const realCostPerUnit = policy.realCostPerUnit;
    const customerRate = Number(item.rate || 0);

    if (product && customerRate !== suggestedRate) {
      reasons.push("price_override");
    }

    if (minimumAllowedRate > 0 && customerRate > 0 && customerRate < minimumAllowedRate) {
      reasons.push("minimum_rate_breach");
    }

    if (realCostPerUnit > 0 && customerRate > 0 && customerRate < realCostPerUnit) {
      reasons.push("minimum_rate_breach");
    }

    const discountApprovalReason = getDiscountApprovalReason(customerRate, policy);
    if (discountApprovalReason) {
      reasons.push(discountApprovalReason);
    }
  }

  if (previousStatus === "approved") {
    reasons.push("invoice_edit");
  }

  if (systemDiscountMeta?.approval_level === "manager") {
    reasons.push("manager_discount_approval");
  }

  if (systemDiscountMeta?.approval_level === "owner") {
    reasons.push("owner_discount_approval");
  }

  return [...new Set(reasons)];
}

async function assertInventoryAvailability(client, items) {
  const productMap = await getProductMap(client, items);

  for (const item of items) {
    if (!item.product_id) {
      continue;
    }

    const product = productMap.get(item.product_id);

    if (!product) {
      throw new Error(`Inventory product missing for item ${item.product_name}`);
    }

    const quantity = Math.round(Number(item.quantity || 0));

    if (quantity > Number(product.stock_sqft || 0)) {
      throw new Error(`Insufficient stock for ${product.name}. Available ${product.stock_sqft}, required ${quantity}.`);
    }
  }
}

async function applyInventoryDelta(client, items, direction) {
  for (const item of items) {
    if (!item.product_id) {
      continue;
    }

    const quantity = Math.round(Number(item.quantity || 0));
    if (quantity <= 0) {
      continue;
    }

    await client.query(
      `UPDATE products
       SET stock_sqft = stock_sqft + $1
       WHERE id = $2`,
      [direction * quantity, item.product_id]
    );
  }
}

async function fetchInvoiceDetail(client, invoiceId) {
  const [invoiceResult, itemsResult, paymentsResult, activityResult] = await Promise.all([
    client.query(
      `SELECT
         i.*,
         l.name AS lead_name,
         q.id AS quotation_ref_id,
         p.project_name,
         created_user.name AS created_by_user_name,
         updated_user.name AS updated_by_user_name,
         approved_user.name AS approved_by_user_name,
         rejected_user.name AS rejected_by_user_name,
         cancelled_user.name AS cancelled_by_user_name
       FROM invoices i
       LEFT JOIN leads l ON l.id = i.lead_id
       LEFT JOIN quotations q ON q.id = i.quotation_id
       LEFT JOIN projects p ON p.id = i.project_id
       LEFT JOIN users created_user ON created_user.id = i.created_by
       LEFT JOIN users updated_user ON updated_user.id = i.updated_by
       LEFT JOIN users approved_user ON approved_user.id = i.approved_by
       LEFT JOIN users rejected_user ON rejected_user.id = i.rejected_by
       LEFT JOIN users cancelled_user ON cancelled_user.id = i.cancelled_by
       WHERE i.id = $1
       LIMIT 1`,
      [invoiceId]
    ),
    client.query(
      `SELECT *
       FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY id ASC`,
      [invoiceId]
    ),
    client.query(
      `SELECT p.*, u.name AS received_by_name
       FROM invoice_payments p
       LEFT JOIN users u ON u.id = p.received_by
       WHERE p.invoice_id = $1
       ORDER BY p.received_at DESC, p.id DESC`,
      [invoiceId]
    ),
    client.query(
      `SELECT a.*, u.name AS created_by_name
       FROM invoice_activity_logs a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.invoice_id = $1
       ORDER BY a.created_at DESC, a.id DESC`,
      [invoiceId]
    ),
  ]);

  if (!invoiceResult.rowCount) {
    return null;
  }

  return {
    ...invoiceResult.rows[0],
    items: itemsResult.rows,
    payments: paymentsResult.rows,
    activities: activityResult.rows,
  };
}

router.get(
  "/",
  requireRole("admin", "manager", "accounts", "sales", "operator", "reports"),
  async (req, res) => {
    const limit = parseListLimit(req.query.limit);
    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status);
    const paymentStatus = normalizeText(req.query.payment_status);
    const from = normalizeText(req.query.from);
    const to = normalizeText(req.query.to);

    const cacheKey = `billing:list:${limit}:${search}:${status}:${paymentStatus}:${from}:${to}`;

    try {
      const payload = await getOrSetCache(cacheKey, BILLING_TTL_MS, async () => {
        const conditions = [];
        const params = [];

        if (search) {
          params.push(`%${search}%`);
          conditions.push(
            `(i.customer_name ILIKE $${params.length} OR i.customer_mobile ILIKE $${params.length} OR i.invoice_number ILIKE $${params.length} OR i.site_reference ILIKE $${params.length})`
          );
        }

        if (status) {
          params.push(status);
          conditions.push(`i.status = $${params.length}`);
        }

        if (paymentStatus) {
          params.push(paymentStatus);
          conditions.push(`i.payment_status = $${params.length}`);
        }

        if (from) {
          params.push(from);
          conditions.push(`i.invoice_date >= $${params.length}::date`);
        }

        if (to) {
          params.push(to);
          conditions.push(`i.invoice_date <= $${params.length}::date`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit);

        const monthBounds = getMonthBounds();
        const [invoicesResult, summaryResult, dailyReportResult, productWiseResult, customerLedgerResult, paymentReportResult, overheadSummaryResult, profitSummaryResult, topProfitProductsResult, lowProfitProductsResult, leadsResult, quotationsResult, projectsResult, productsResult] =
          await Promise.all([
            query(
              `SELECT
                 i.id,
                 i.invoice_number,
                 i.invoice_type,
                 i.invoice_date,
                 i.customer_name,
                 i.customer_mobile,
                 i.site_reference,
                 i.status,
                 i.payment_status,
                 i.approval_required,
                 i.approval_reason,
                 i.grand_total,
                 i.received_amount,
                 i.remaining_amount,
                 i.gst_amount,
                 i.created_at,
                 i.updated_at,
                 i.notes,
                 i.lead_id,
                 i.quotation_id,
                 i.project_id,
                 i.transport_charge,
                 i.additional_charge,
                 i.subtotal,
                 i.total_discount,
                 created_user.name AS created_by_user_name,
                 approved_user.name AS approved_by_user_name
               FROM invoices i
               LEFT JOIN users created_user ON created_user.id = i.created_by
               LEFT JOIN users approved_user ON approved_user.id = i.approved_by
               ${where}
               ORDER BY i.invoice_date DESC, i.id DESC
               LIMIT $${params.length}`,
              params
            ),
            query(
              `SELECT
                 COALESCE(SUM(i.grand_total) FILTER (WHERE i.invoice_date = CURRENT_DATE AND i.status = 'approved'), 0)::numeric AS today_billing,
                 COUNT(*) FILTER (WHERE i.status = 'approved')::int AS total_bills,
                 COUNT(*) FILTER (WHERE i.status = 'approved' AND i.payment_status = 'paid')::int AS paid_bills,
                 COUNT(*) FILTER (WHERE i.status = 'pending_approval' OR i.approval_required = TRUE)::int AS pending_bills,
                 0::numeric AS gst_amount,
                 COALESCE(SUM(i.grand_total) FILTER (WHERE DATE_TRUNC('month', i.invoice_date) = DATE_TRUNC('month', CURRENT_DATE) AND i.status = 'approved'), 0)::numeric AS monthly_billing,
                 COALESCE((
                   SELECT SUM(p.amount)
                   FROM invoice_payments p
                   JOIN invoices ip ON ip.id = p.invoice_id
                   WHERE p.received_at::date = CURRENT_DATE
                     AND ip.status = 'approved'
                 ), 0)::numeric AS todays_collection
               FROM invoices i`
            ),
            query(
              `SELECT invoice_date::date AS report_date,
                      COUNT(*)::int AS bill_count,
                      COALESCE(SUM(grand_total), 0)::numeric AS total_amount,
                      COALESCE(SUM(received_amount), 0)::numeric AS received_amount
               FROM invoices
               WHERE status = 'approved'
                 AND invoice_date >= CURRENT_DATE - INTERVAL '14 days'
               GROUP BY invoice_date::date
               ORDER BY report_date DESC`
            ),
            query(
              `SELECT
                 ii.product_name,
                 ii.item_type,
                 COALESCE(SUM(ii.quantity), 0)::numeric AS total_quantity,
                 COALESCE(SUM(ii.total), 0)::numeric AS total_sales,
                 COALESCE(SUM(
                   CASE
                     WHEN LOWER(COALESCE(ii.unit, '')) IN ('box', 'boxes') THEN ii.quantity
                     WHEN COALESCE(p.pieces_per_box, 0) > 0 THEN ii.quantity / NULLIF(p.pieces_per_box, 0)
                     ELSE 0
                   END
                 ), 0)::numeric AS total_boxes,
                 COALESCE(SUM(
                   CASE
                     WHEN LOWER(COALESCE(ii.unit, '')) IN ('sqft', 'square feet', 'square_feet') THEN ii.quantity
                     WHEN LOWER(COALESCE(ii.unit, '')) IN ('box', 'boxes') THEN ii.quantity * COALESCE(p.sqft_per_box, 0)
                     WHEN COALESCE(p.pieces_per_box, 0) > 0 THEN (ii.quantity / NULLIF(p.pieces_per_box, 0)) * COALESCE(p.sqft_per_box, 0)
                     ELSE 0
                   END
                 ), 0)::numeric AS total_sqft
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
               LEFT JOIN products p ON p.id = ii.product_id
               WHERE i.status = 'approved'
                 AND i.invoice_date >= $1::date
                 AND i.invoice_date < $2::date
               GROUP BY ii.product_name, ii.item_type
               ORDER BY total_sales DESC
               LIMIT 20`,
              [monthBounds.from, monthBounds.to]
            ),
            query(
              `SELECT
                 i.customer_name,
                 i.customer_mobile,
                 COUNT(*)::int AS bill_count,
                 COALESCE(SUM(i.grand_total), 0)::numeric AS billed_amount,
                 COALESCE(SUM(i.received_amount), 0)::numeric AS received_amount,
                 COALESCE(SUM(i.remaining_amount), 0)::numeric AS pending_amount
               FROM invoices i
               WHERE i.status = 'approved'
               GROUP BY i.customer_name, i.customer_mobile
               ORDER BY billed_amount DESC
               LIMIT 30`
            ),
            query(
              `SELECT
                 i.invoice_number,
                 i.customer_name,
                 i.payment_status,
                 COALESCE(i.grand_total, 0)::numeric AS total_amount,
                 COALESCE(i.received_amount, 0)::numeric AS received_amount,
                 COALESCE(i.remaining_amount, 0)::numeric AS remaining_amount
               FROM invoices i
               WHERE i.status = 'approved'
               ORDER BY i.invoice_date DESC, i.id DESC
               LIMIT 50`
            ),
            query(
              `SELECT
                 LOWER(TRIM(category)) AS category,
                 COALESCE(SUM(amount), 0)::numeric AS amount
               FROM expenses
               WHERE expense_date >= $1::date
                 AND expense_date < $2::date
               GROUP BY LOWER(TRIM(category))`,
              [monthBounds.from, monthBounds.to]
            ),
            query(
              `SELECT
                 COALESCE(SUM(ii.total - (ii.quantity * COALESCE(p.real_cost_per_unit, p.landed_cost_per_unit, 0))), 0)::numeric AS gross_profit,
                 COALESCE(SUM(ii.total - (ii.quantity * COALESCE(p.final_business_cost_per_unit, p.real_cost_per_unit, p.landed_cost_per_unit, 0))), 0)::numeric AS net_profit
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
               LEFT JOIN products p ON p.id = ii.product_id
               WHERE i.status = 'approved'
                 AND i.invoice_date >= $1::date
                 AND i.invoice_date < $2::date`,
              [monthBounds.from, monthBounds.to]
            ),
            query(
              `SELECT
                 ii.product_name,
                 COALESCE(SUM(ii.total), 0)::numeric AS sales_total,
                 COALESCE(SUM(ii.quantity * COALESCE(p.real_cost_per_unit, p.landed_cost_per_unit, 0)), 0)::numeric AS gross_cost_total,
                 COALESCE(SUM(ii.quantity * COALESCE(p.final_business_cost_per_unit, p.real_cost_per_unit, p.landed_cost_per_unit, 0)), 0)::numeric AS business_cost_total,
                 COALESCE(SUM(ii.total - (ii.quantity * COALESCE(p.final_business_cost_per_unit, p.real_cost_per_unit, p.landed_cost_per_unit, 0))), 0)::numeric AS estimated_profit
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
               LEFT JOIN products p ON p.id = ii.product_id
               WHERE i.status = 'approved'
                 AND i.invoice_date >= $1::date
                 AND i.invoice_date < $2::date
               GROUP BY ii.product_name
               ORDER BY estimated_profit DESC
               LIMIT 8`,
              [monthBounds.from, monthBounds.to]
            ),
            query(
              `SELECT
                 ii.product_name,
                 COALESCE(SUM(ii.total), 0)::numeric AS sales_total,
                 COALESCE(SUM(ii.quantity * COALESCE(p.final_business_cost_per_unit, p.real_cost_per_unit, p.landed_cost_per_unit, 0)), 0)::numeric AS business_cost_total,
                 COALESCE(SUM(ii.total - (ii.quantity * COALESCE(p.final_business_cost_per_unit, p.real_cost_per_unit, p.landed_cost_per_unit, 0))), 0)::numeric AS estimated_profit
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
               LEFT JOIN products p ON p.id = ii.product_id
               WHERE i.status = 'approved'
                 AND i.invoice_date >= $1::date
                 AND i.invoice_date < $2::date
               GROUP BY ii.product_name
               ORDER BY estimated_profit ASC
               LIMIT 8`,
              [monthBounds.from, monthBounds.to]
            ),
            query(
              `SELECT id, name, phone, location
               FROM leads
               ORDER BY created_at DESC
               LIMIT 200`
            ),
            query(
              `SELECT q.id, q.lead_id, q.final_amount, l.name AS lead_name, l.phone AS lead_phone
               FROM quotations q
               LEFT JOIN leads l ON l.id = q.lead_id
               ORDER BY q.created_at DESC, q.id DESC
               LIMIT 200`
            ),
            query(
              `SELECT id, project_name, project_code, lead_id
               FROM projects
               ORDER BY created_at DESC, id DESC
               LIMIT 200`
            ),
            query(
              `SELECT
                 id,
                 name,
                 business_unit,
                 category,
                 status,
                 company_name,
                 product_size,
                 tile_size,
                 finish,
                 stock_sqft,
                 price_per_sqft,
                 predefined_rate,
                 today_selling_rate,
                 daily_up_limit_percent,
                 daily_down_limit_percent,
                 last_purchase_rate,
                 landed_cost_per_unit,
                 real_cost_per_unit,
                 overhead_cost_per_unit,
                 final_business_cost_per_unit,
                 minimum_allowed_rate,
                 suggested_selling_rate,
                 operator_discount_cap,
                 manager_discount_cap,
                 owner_discount_cap,
                 quotation_validity_days
               FROM products
               WHERE status <> 'dead_stock'
               ORDER BY name ASC
               LIMIT 300`
            ),
          ]);

        const monthlyOverhead = overheadSummaryResult.rows.reduce(
          (sum, row) => sum + (includeMonthlyOverheadCategory(row.category) ? toNumber(row.amount) : 0),
          0
        );
        const approvedMonthlyBilling = toNumber(summaryResult.rows[0]?.monthly_billing);
        const approvedTodayBilling = toNumber(summaryResult.rows[0]?.today_billing);
        const approvedTodayCollection = toNumber(summaryResult.rows[0]?.todays_collection);
        const monthlySoldBoxes = productWiseResult.rows.reduce((sum, row) => sum + Number(row.total_boxes || 0), 0);
        const monthlySoldSqft = productWiseResult.rows.reduce((sum, row) => sum + Number(row.total_sqft || 0), 0);
        const overheadPerBox = monthlySoldBoxes > 0 ? Number((monthlyOverhead / monthlySoldBoxes).toFixed(2)) : 0;
        const overheadPerSqft = monthlySoldSqft > 0 ? Number((monthlyOverhead / monthlySoldSqft).toFixed(2)) : 0;
        const grossProfit = toNumber(profitSummaryResult.rows[0]?.gross_profit);
        const netProfit = toNumber(profitSummaryResult.rows[0]?.net_profit);

        return {
          invoices: invoicesResult.rows,
          summary: {
            ...(summaryResult.rows[0] || {}),
            today_billing: approvedTodayBilling,
            todays_collection: approvedTodayCollection,
            monthly_billing: approvedMonthlyBilling,
            monthly_overhead: monthlyOverhead,
            monthly_sold_boxes: monthlySoldBoxes,
            monthly_sold_sqft: monthlySoldSqft,
            overhead_per_box: overheadPerBox,
            overhead_per_sqft: overheadPerSqft,
            gross_profit: Number(grossProfit.toFixed(2)),
            net_profit: Number(netProfit.toFixed(2)),
            overhead_warning: monthlyOverhead > 0 && monthlySoldBoxes <= 0 ? "Overhead not calculated because monthly sales boxes are zero." : "",
          },
          reports: {
            daily_billing: dailyReportResult.rows,
            product_wise_sales: productWiseResult.rows,
            customer_ledger: customerLedgerResult.rows,
            gst_report: [],
            payment_report: paymentReportResult.rows,
            billing_summary: {
              ...(summaryResult.rows[0] || {}),
              monthly_overhead: monthlyOverhead,
              overhead_per_box: overheadPerBox,
              overhead_per_sqft: overheadPerSqft,
              gross_profit: Number(grossProfit.toFixed(2)),
              net_profit: Number(netProfit.toFixed(2)),
            },
            top_profitable_products: topProfitProductsResult.rows,
            low_profit_products: lowProfitProductsResult.rows,
          },
          references: {
            leads: leadsResult.rows,
            quotations: quotationsResult.rows,
            projects: projectsResult.rows,
            products: productsResult.rows,
          },
        };
      });

      return res.json(payload);
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch billing dashboard", error: error.message });
    }
  }
);

router.get(
  "/:id",
  requireRole("admin", "manager", "accounts", "sales", "operator", "reports"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const detail = await fetchInvoiceDetail(client, req.params.id);

      if (!detail) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      return res.json(detail);
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch invoice detail", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.get(
  "/:id/pdf",
  requireRole("admin", "manager", "accounts", "sales", "operator", "reports"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const detail = await fetchInvoiceDetail(client, req.params.id);

      if (!detail) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      streamBillingInvoicePdf(
        {
          invoice: detail,
          items: detail.items || [],
          payments: detail.payments || [],
          type: req.query.type === "estimate" ? "estimate" : detail.invoice_type,
        },
        res
      );
    } catch (error) {
      return res.status(500).json({ message: "Unable to generate invoice PDF", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/",
  requireRole("admin", "manager", "accounts", "sales", "operator"),
  async (req, res) => {
    const validation = validateBillingInvoicePayload(sanitizeBillingInvoicePayload(req.body));
    const systemDiscountMeta = normalizeSystemDiscountMeta(req.body?.system_discount_meta);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const invoice = validation.value;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const productMap = await getProductMap(client, invoice.items);
      await assertInventoryAvailability(client, invoice.items);

      const isPrivilegedApprover = req.user.roles?.includes("admin") || req.user.roles?.includes("manager") || req.user.role === "admin" || req.user.role === "manager";
      const approvalReasons = evaluateApprovalReasons(invoice, productMap, { systemDiscountMeta });
      const shouldSubmit =
        invoice.status === "pending_approval" || (!isPrivilegedApprover && approvalReasons.length > 0);
      const finalStatus = shouldSubmit ? "pending_approval" : invoice.status === "approved" && isPrivilegedApprover ? "approved" : "draft";

      const invoiceInsert = await client.query(
        `INSERT INTO invoices (
           invoice_number, invoice_type, invoice_date, customer_name, customer_mobile, customer_address,
           lead_id, quotation_id, project_id, site_reference, status, payment_status,
           subtotal, total_discount, gst_amount, transport_charge, additional_charge,
           grand_total, received_amount, remaining_amount, notes,
           approval_required, approval_reason, approval_note, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unpaid', $12, $13, $14, $15, $16, $17, 0, $17, $18, $19, $20, $21, $22, $22)
         RETURNING id`,
        [
          toInvoiceNumber(invoice.invoice_type),
          invoice.invoice_type,
          invoice.invoice_date,
          invoice.customer_name,
          invoice.customer_mobile,
          invoice.customer_address,
          invoice.lead_id,
          invoice.quotation_id,
          invoice.project_id,
          invoice.site_reference,
          finalStatus,
          invoice.subtotal,
          invoice.total_discount,
          invoice.gst_amount,
          invoice.transport_charge,
          invoice.additional_charge,
          invoice.grand_total,
          invoice.notes,
          approvalReasons.length > 0 || shouldSubmit,
          buildApprovalReasonText(approvalReasons),
          invoice.approval_note,
          req.user.id,
        ]
      );

      const invoiceId = invoiceInsert.rows[0].id;

      for (const item of invoice.items) {
        await client.query(
          `INSERT INTO invoice_items (
             invoice_id, product_id, item_type, product_name, quantity, unit, rate, discount, gst_percent, total
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            invoiceId,
            item.product_id,
            item.item_type,
            item.product_name,
            item.quantity,
            item.unit,
            item.rate,
            item.discount,
            item.gst_percent,
            item.total,
          ]
        );
      }

      await applyInventoryDelta(client, invoice.items, -1);
      await client.query("UPDATE invoices SET stock_applied = TRUE WHERE id = $1", [invoiceId]);
      await logInvoiceActivity(client, invoiceId, "created", req.user.id, "Invoice created from CRM.");
      if (systemDiscountMeta) {
        await logInvoiceActivity(client, invoiceId, "system_discount_applied", req.user.id, buildSystemDiscountAuditText(systemDiscountMeta));
      }
      await logInvoiceActivity(client, invoiceId, "stock_reduced", req.user.id, "Inventory reduced on invoice save.");

      if (finalStatus === "pending_approval") {
        await logInvoiceActivity(
          client,
          invoiceId,
          "submitted_for_approval",
          req.user.id,
          buildApprovalReasonText(approvalReasons) || "Invoice submitted for approval."
        );
      }

      await client.query("COMMIT");
      invalidateCachePrefix("billing:");
      const detail = await fetchInvoiceDetail(client, invoiceId);
      return res.status(201).json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to create invoice", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id",
  requireRole("admin", "manager", "accounts", "sales", "operator"),
  async (req, res) => {
    const validation = validateBillingInvoicePayload(sanitizeBillingInvoicePayload(req.body));
    const systemDiscountMeta = normalizeSystemDiscountMeta(req.body?.system_discount_meta);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const invoice = validation.value;
    const invoiceId = Number(req.params.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await fetchInvoiceDetail(client, invoiceId);
      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (existing.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Cancelled invoices cannot be edited" });
      }

      const productMap = await getProductMap(client, invoice.items);
      if (existing.stock_applied) {
        await applyInventoryDelta(client, existing.items || [], 1);
      }
      await assertInventoryAvailability(client, invoice.items);
      await applyInventoryDelta(client, invoice.items, -1);

      const isPrivilegedApprover = req.user.roles?.includes("admin") || req.user.roles?.includes("manager") || req.user.role === "admin" || req.user.role === "manager";
      const approvalReasons = evaluateApprovalReasons(invoice, productMap, { previousStatus: existing.status, systemDiscountMeta });
      const finalStatus = !isPrivilegedApprover || invoice.status === "pending_approval" || approvalReasons.length
        ? "pending_approval"
        : invoice.status === "approved"
          ? "approved"
          : "draft";

      await client.query(
        `UPDATE invoices
         SET invoice_type = $1,
             invoice_date = $2,
             customer_name = $3,
             customer_mobile = $4,
             customer_address = $5,
             lead_id = $6,
             quotation_id = $7,
             project_id = $8,
             site_reference = $9,
             status = $10,
             subtotal = $11,
             total_discount = $12,
             gst_amount = $13,
             transport_charge = $14,
             additional_charge = $15,
             grand_total = $16,
             remaining_amount = GREATEST($16 - received_amount, 0),
             notes = $17,
             approval_required = $18,
             approval_reason = $19,
             approval_note = $20,
             updated_by = $21,
             updated_at = CURRENT_TIMESTAMP,
             approved_by = CASE WHEN $10 = 'approved' THEN $21 ELSE NULL END,
             approved_at = CASE WHEN $10 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
             rejected_by = CASE WHEN $10 = 'rejected' THEN $21 ELSE NULL END,
             rejected_at = CASE WHEN $10 = 'rejected' THEN CURRENT_TIMESTAMP ELSE NULL END,
             stock_applied = TRUE
         WHERE id = $22`,
        [
          invoice.invoice_type,
          invoice.invoice_date,
          invoice.customer_name,
          invoice.customer_mobile,
          invoice.customer_address,
          invoice.lead_id,
          invoice.quotation_id,
          invoice.project_id,
          invoice.site_reference,
          finalStatus,
          invoice.subtotal,
          invoice.total_discount,
          invoice.gst_amount,
          invoice.transport_charge,
          invoice.additional_charge,
          invoice.grand_total,
          invoice.notes,
          approvalReasons.length > 0 || finalStatus === "pending_approval",
          buildApprovalReasonText(approvalReasons),
          invoice.approval_note,
          req.user.id,
          invoiceId,
        ]
      );

      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);

      for (const item of invoice.items) {
        await client.query(
          `INSERT INTO invoice_items (
             invoice_id, product_id, item_type, product_name, quantity, unit, rate, discount, gst_percent, total
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            invoiceId,
            item.product_id,
            item.item_type,
            item.product_name,
            item.quantity,
            item.unit,
            item.rate,
            item.discount,
            item.gst_percent,
            item.total,
          ]
        );
      }

      await logInvoiceActivity(client, invoiceId, "updated", req.user.id, "Invoice edited from CRM.");
      if (systemDiscountMeta) {
        await logInvoiceActivity(client, invoiceId, "system_discount_applied", req.user.id, buildSystemDiscountAuditText(systemDiscountMeta));
      }
      await logInvoiceActivity(client, invoiceId, "stock_reduced", req.user.id, "Inventory resynced after invoice edit.");
      if (finalStatus === "pending_approval") {
        await logInvoiceActivity(
          client,
          invoiceId,
          "submitted_for_approval",
          req.user.id,
          buildApprovalReasonText(approvalReasons) || "Invoice updated and sent for approval."
        );
      }

      await client.query("COMMIT");
      invalidateCachePrefix("billing:");
      const detail = await fetchInvoiceDetail(client, invoiceId);
      return res.json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to update invoice", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id/submit-approval",
  requireRole("admin", "manager", "accounts", "sales", "operator"),
  async (req, res) => {
    const note = normalizeText(req.body?.note);

    try {
      const result = await query(
        `UPDATE invoices
         SET status = 'pending_approval',
             approval_required = TRUE,
             approval_reason = CASE
               WHEN approval_reason IS NULL OR approval_reason = '' THEN 'Manual approval requested'
               ELSE approval_reason
             END,
             approval_note = CASE WHEN $1 <> '' THEN $1 ELSE approval_note END,
             updated_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id`,
        [note, req.user.id, req.params.id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await query(
        `INSERT INTO invoice_activity_logs (invoice_id, action, note, created_by)
         VALUES ($1, 'submitted_for_approval', $2, $3)`,
        [req.params.id, note || "Manual approval requested.", req.user.id]
      );

      invalidateCachePrefix("billing:");
      const client = await pool.connect();
      try {
        const detail = await fetchInvoiceDetail(client, req.params.id);
        return res.json(detail);
      } finally {
        client.release();
      }
    } catch (error) {
      return res.status(500).json({ message: "Unable to submit invoice for approval", error: error.message });
    }
  }
);

router.put(
  "/:id/approval",
  requireRole("admin", "manager"),
  async (req, res) => {
    const validation = validateBillingApprovalPayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const { action, note } = validation.value;
    const invoiceId = Number(req.params.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const existing = await fetchInvoiceDetail(client, invoiceId);
      const isAdmin = req.user.roles?.includes("admin") || req.user.role === "admin";

      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (
        action === "approve" &&
        existing.approval_reason &&
        existing.approval_reason.toLowerCase().includes("owner discount approval") &&
        !isAdmin
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Owner discount approval can only be approved by admin." });
      }

      const cancellationRequested = normalizeText(existing.approval_reason).toLowerCase().includes("invoice cancellation");

      if (action === "approved") {
        if (cancellationRequested && existing.stock_applied) {
          await applyInventoryDelta(client, existing.items || [], 1);
        }

        await client.query(
          `UPDATE invoices
           SET status = $1,
               approval_required = FALSE,
               approval_note = $2,
               approved_by = $3,
               approved_at = CURRENT_TIMESTAMP,
               cancelled_by = CASE WHEN $1 = 'cancelled' THEN $3 ELSE cancelled_by END,
               cancelled_at = CASE WHEN $1 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
               stock_applied = CASE WHEN $1 = 'cancelled' THEN FALSE ELSE stock_applied END,
               updated_by = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [cancellationRequested ? "cancelled" : "approved", note, req.user.id, invoiceId]
        );

        await logInvoiceActivity(
          client,
          invoiceId,
          cancellationRequested ? "cancelled" : "approved",
          req.user.id,
          note || (cancellationRequested ? "Invoice cancellation approved." : "Invoice approved.")
        );
      } else {
        await client.query(
          `UPDATE invoices
           SET status = 'rejected',
               approval_required = FALSE,
               approval_note = $1,
               rejected_by = $2,
               rejected_at = CURRENT_TIMESTAMP,
               updated_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [note, req.user.id, invoiceId]
        );

        await logInvoiceActivity(client, invoiceId, "rejected", req.user.id, note || "Invoice rejected.");
      }

      await client.query("COMMIT");
      invalidateCachePrefix("billing:");
      const detail = await fetchInvoiceDetail(client, invoiceId);
      return res.json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to review invoice approval", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.put(
  "/:id/cancel",
  requireRole("admin", "manager", "accounts", "sales", "operator"),
  async (req, res) => {
    const note = normalizeText(req.body?.note);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const existing = await fetchInvoiceDetail(client, req.params.id);

      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Invoice not found" });
      }

      const isAdmin = req.user.roles?.includes("admin") || req.user.role === "admin";

      if (isAdmin) {
        if (existing.stock_applied) {
          await applyInventoryDelta(client, existing.items || [], 1);
        }

        await client.query(
          `UPDATE invoices
           SET status = 'cancelled',
               approval_required = FALSE,
               approval_reason = 'Invoice cancellation',
               approval_note = $1,
               cancelled_by = $2,
               cancelled_at = CURRENT_TIMESTAMP,
               updated_by = $2,
               updated_at = CURRENT_TIMESTAMP,
               stock_applied = FALSE
           WHERE id = $3`,
          [note, req.user.id, req.params.id]
        );
        await logInvoiceActivity(client, req.params.id, "cancelled", req.user.id, note || "Invoice cancelled by admin.");
      } else {
        await client.query(
          `UPDATE invoices
           SET status = 'pending_approval',
               approval_required = TRUE,
               approval_reason = 'Invoice cancellation',
               approval_note = $1,
               updated_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [note, req.user.id, req.params.id]
        );
        await logInvoiceActivity(
          client,
          req.params.id,
          "submitted_for_approval",
          req.user.id,
          note || "Invoice cancellation requested."
        );
      }

      await client.query("COMMIT");
      invalidateCachePrefix("billing:");
      const detail = await fetchInvoiceDetail(client, req.params.id);
      return res.json(detail);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to process invoice cancellation", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/:id/payments",
  requireRole("admin", "manager", "accounts", "operator"),
  async (req, res) => {
    const validation = validateBillingPaymentPayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const payment = validation.value;
    const invoiceId = Number(req.params.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const detail = await fetchInvoiceDetail(client, invoiceId);

      if (!detail) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (detail.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Cancelled invoices cannot accept payment" });
      }

      await client.query(
        `INSERT INTO invoice_payments (invoice_id, amount, payment_mode, note, received_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, payment.amount, payment.payment_mode, payment.note, req.user.id]
      );

      const nextReceivedAmount = Number(detail.received_amount || 0) + Number(payment.amount || 0);
      const grandTotal = Number(detail.grand_total || 0);
      const paymentMismatch = nextReceivedAmount > grandTotal;
      const paymentStatus = derivePaymentStatus(grandTotal, nextReceivedAmount);
      const isPrivilegedApprover = req.user.roles?.includes("admin") || req.user.roles?.includes("manager") || req.user.role === "admin" || req.user.role === "manager";

      await client.query(
        `UPDATE invoices
         SET received_amount = $1,
             remaining_amount = GREATEST(grand_total - $1, 0),
             payment_status = $2,
             payment_mode = CASE
               WHEN payment_mode IS NULL OR payment_mode = '' OR payment_mode = $3 THEN $3
               ELSE 'mixed'
             END,
             status = CASE
               WHEN $4 THEN 'pending_approval'
               ELSE status
             END,
             approval_required = CASE WHEN $4 THEN TRUE ELSE approval_required END,
             approval_reason = CASE
               WHEN $4 THEN 'Payment mismatch'
               ELSE approval_reason
             END,
             updated_by = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [nextReceivedAmount, paymentStatus, payment.payment_mode, paymentMismatch && !isPrivilegedApprover, req.user.id, invoiceId]
      );

      await logInvoiceActivity(client, invoiceId, "payment_recorded", req.user.id, payment.note || `Payment recorded via ${payment.payment_mode}.`);
      if (paymentMismatch && !isPrivilegedApprover) {
        await logInvoiceActivity(client, invoiceId, "submitted_for_approval", req.user.id, "Payment mismatch requires approval.");
      }

      await client.query("COMMIT");
      invalidateCachePrefix("billing:");
      const updated = await fetchInvoiceDetail(client, invoiceId);
      return res.status(201).json(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "Unable to record invoice payment", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await fetchInvoiceDetail(client, req.params.id);

    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (existing.stock_applied) {
      await applyInventoryDelta(client, existing.items || [], 1);
    }

    await client.query("DELETE FROM invoices WHERE id = $1", [req.params.id]);
    await client.query("COMMIT");
    invalidateCachePrefix("billing:");
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Unable to delete invoice", error: error.message });
  } finally {
    client.release();
  }
});

export default router;
