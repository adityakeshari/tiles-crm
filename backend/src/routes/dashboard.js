import express from "express";
import { query } from "../db.js";
import { getOrSetCache } from "../utils/ttlCache.js";

const router = express.Router();

const SUMMARY_TTL_MS = 30 * 1000; // 30 seconds - small enough for "live" feel, large enough to absorb burst loads.
const BUSINESS_TIMEZONE = "Asia/Kolkata";
const EMPTY_DASHBOARD_SUMMARY = {
  sales_today: { amount: 0, count: 0 },
  sales_month: { amount: 0, count: 0 },
  collection_today: { amount: 0, count: 0 },
  collection_month: { amount: 0, count: 0 },
  pending_payments: { amount: 0, lead_count: 0 },
  active_customers: { count: 0 },
  active_projects: { count: 0 },
  token_pending: { count: 0, amount: 0 },
  token_paid_month: { count: 0, amount: 0 },
  expenses_today: { amount: 0, count: 0 },
  expenses_month: { amount: 0, count: 0 },
  purchases_today: { amount: 0, count: 0 },
  purchases_month: { amount: 0, count: 0 },
  followups_pending: { count: 0 },
  low_stock_items: { count: 0 },
  as_of_date: "",
};

function normalizeCountedAmount(value, defaults = {}) {
  const next = { ...defaults };

  if (!value || typeof value !== "object") {
    return next;
  }

  for (const key of Object.keys(next)) {
    const parsed = Number(value[key]);
    next[key] = Number.isFinite(parsed) ? parsed : next[key];
  }

  return next;
}

function normalizeDashboardSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return { ...EMPTY_DASHBOARD_SUMMARY };
  }

  return {
    sales_today: normalizeCountedAmount(summary.sales_today, EMPTY_DASHBOARD_SUMMARY.sales_today),
    sales_month: normalizeCountedAmount(summary.sales_month, EMPTY_DASHBOARD_SUMMARY.sales_month),
    collection_today: normalizeCountedAmount(summary.collection_today, EMPTY_DASHBOARD_SUMMARY.collection_today),
    collection_month: normalizeCountedAmount(summary.collection_month, EMPTY_DASHBOARD_SUMMARY.collection_month),
    pending_payments: normalizeCountedAmount(summary.pending_payments, EMPTY_DASHBOARD_SUMMARY.pending_payments),
    active_customers: normalizeCountedAmount(summary.active_customers, EMPTY_DASHBOARD_SUMMARY.active_customers),
    active_projects: normalizeCountedAmount(summary.active_projects, EMPTY_DASHBOARD_SUMMARY.active_projects),
    token_pending: normalizeCountedAmount(summary.token_pending, EMPTY_DASHBOARD_SUMMARY.token_pending),
    token_paid_month: normalizeCountedAmount(summary.token_paid_month, EMPTY_DASHBOARD_SUMMARY.token_paid_month),
    expenses_today: normalizeCountedAmount(summary.expenses_today, EMPTY_DASHBOARD_SUMMARY.expenses_today),
    expenses_month: normalizeCountedAmount(summary.expenses_month, EMPTY_DASHBOARD_SUMMARY.expenses_month),
    purchases_today: normalizeCountedAmount(summary.purchases_today, EMPTY_DASHBOARD_SUMMARY.purchases_today),
    purchases_month: normalizeCountedAmount(summary.purchases_month, EMPTY_DASHBOARD_SUMMARY.purchases_month),
    followups_pending: normalizeCountedAmount(summary.followups_pending, EMPTY_DASHBOARD_SUMMARY.followups_pending),
    low_stock_items: normalizeCountedAmount(summary.low_stock_items, EMPTY_DASHBOARD_SUMMARY.low_stock_items),
    as_of_date: typeof summary.as_of_date === "string" ? summary.as_of_date : EMPTY_DASHBOARD_SUMMARY.as_of_date,
  };
}

router.get("/summary", async (_req, res) => {
  try {
    const summary = await getOrSetCache("dashboard:summary:v2", SUMMARY_TTL_MS, async () => {
      const sql = `
        WITH business_clock AS (
          SELECT
            timezone('${BUSINESS_TIMEZONE}', NOW()) AS local_now,
            timezone('${BUSINESS_TIMEZONE}', NOW())::date AS local_date
        ),
        sales_today AS (
          SELECT COALESCE(SUM(final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations
           WHERE timezone('${BUSINESS_TIMEZONE}', created_at)::date = (SELECT local_date FROM business_clock)
        ),
        sales_month AS (
          SELECT COALESCE(SUM(final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations
           WHERE DATE_TRUNC('month', timezone('${BUSINESS_TIMEZONE}', created_at)) = DATE_TRUNC('month', (SELECT local_now FROM business_clock))
        ),
        collection_today AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM payments
           WHERE timezone('${BUSINESS_TIMEZONE}', created_at)::date = (SELECT local_date FROM business_clock)
        ),
        collection_month AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM payments
           WHERE DATE_TRUNC('month', timezone('${BUSINESS_TIMEZONE}', created_at)) = DATE_TRUNC('month', (SELECT local_now FROM business_clock))
        ),
        pending_payments AS (
          -- Canonical outstanding formula:
          -- approved invoice grand total - approved invoice payments received.
          -- Credit notes / adjustments are not modeled yet, so remaining_amount
          -- is the current authoritative receivable field.
          SELECT
            COALESCE(SUM(i.remaining_amount), 0)::numeric AS amount,
            COUNT(*) FILTER (WHERE COALESCE(i.remaining_amount, 0) > 0)::int AS lead_count
          FROM invoices i
          WHERE i.status = 'approved'
        ),
        active_customers AS (
          SELECT COUNT(*)::int AS count
            FROM leads
           WHERE status NOT IN ('lost')
        ),
        active_projects AS (
          SELECT COUNT(*)::int AS count
            FROM projects
           WHERE status IN ('active', 'draft', 'on_hold')
        ),
        token_pending AS (
          SELECT COUNT(*)::int AS count,
                 COALESCE(SUM(total_token_amount), 0)::numeric AS amount
            FROM adhesive_token_claims
           WHERE status = 'pending'
        ),
        token_paid_month AS (
          SELECT COUNT(*)::int AS count,
                 COALESCE(SUM(total_token_amount), 0)::numeric AS amount
            FROM adhesive_token_claims
           WHERE status = 'paid'
             AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', (SELECT local_now FROM business_clock))
        ),
        expenses_today AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM expenses
           WHERE expense_date = (SELECT local_date FROM business_clock)
        ),
        expenses_month AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM expenses
           WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', (SELECT local_now FROM business_clock))
        ),
        purchases_today AS (
          SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM purchases
           WHERE purchase_date = (SELECT local_date FROM business_clock)
        ),
        purchases_month AS (
          SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM purchases
           WHERE DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', (SELECT local_now FROM business_clock))
        ),
        followups_pending AS (
          SELECT COUNT(*)::int AS count
            FROM followups
           WHERE status IN ('pending', 'overdue')
        ),
        low_stock_items AS (
          SELECT COUNT(*)::int AS count
            FROM products p
           WHERE CASE
             WHEN COALESCE(p.stock_sqft, 0) <= 0 THEN TRUE
             WHEN (
               CASE
                 WHEN COALESCE(p.sqft_per_box, 0) > 0
                   THEN ROUND((COALESCE(p.stock_sqft, 0)::numeric / NULLIF(p.sqft_per_box, 0)), 2)
                 ELSE COALESCE(p.stock_sqft, 0)::numeric
               END
             ) <= GREATEST(COALESCE(p.low_stock_threshold, 10), 0) THEN TRUE
             ELSE FALSE
           END
        )
        SELECT
          (SELECT row_to_json(t) FROM (SELECT * FROM sales_today) t)         AS sales_today,
          (SELECT row_to_json(t) FROM (SELECT * FROM sales_month) t)         AS sales_month,
          (SELECT row_to_json(t) FROM (SELECT * FROM collection_today) t)    AS collection_today,
          (SELECT row_to_json(t) FROM (SELECT * FROM collection_month) t)    AS collection_month,
          (SELECT row_to_json(t) FROM (SELECT * FROM pending_payments) t)    AS pending_payments,
          (SELECT row_to_json(t) FROM (SELECT * FROM active_customers) t)    AS active_customers,
          (SELECT row_to_json(t) FROM (SELECT * FROM active_projects) t)     AS active_projects,
          (SELECT row_to_json(t) FROM (SELECT * FROM token_pending) t)       AS token_pending,
          (SELECT row_to_json(t) FROM (SELECT * FROM token_paid_month) t)    AS token_paid_month,
          (SELECT row_to_json(t) FROM (SELECT * FROM expenses_today) t)      AS expenses_today,
          (SELECT row_to_json(t) FROM (SELECT * FROM expenses_month) t)      AS expenses_month,
          (SELECT row_to_json(t) FROM (SELECT * FROM purchases_today) t)     AS purchases_today,
          (SELECT row_to_json(t) FROM (SELECT * FROM purchases_month) t)     AS purchases_month,
          (SELECT row_to_json(t) FROM (SELECT * FROM followups_pending) t)   AS followups_pending,
          (SELECT row_to_json(t) FROM (SELECT * FROM low_stock_items) t)     AS low_stock_items,
          TO_CHAR((SELECT local_date FROM business_clock), 'YYYY-MM-DD') AS as_of_date
      `;
      const result = await query(sql);
      return normalizeDashboardSummary(result.rows[0] || {});
    });

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load dashboard summary", error: error.message });
  }
});

export default router;
