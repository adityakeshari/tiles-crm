import express from "express";
import { query } from "../db.js";
import { getOrSetCache } from "../utils/ttlCache.js";

const router = express.Router();

const SUMMARY_TTL_MS = 30 * 1000; // 30 seconds — small enough for "live" feel, large enough to absorb burst loads.

router.get("/summary", async (_req, res) => {
  try {
    const summary = await getOrSetCache("dashboard:summary:v1", SUMMARY_TTL_MS, async () => {
      const sql = `
        WITH today AS (
          SELECT CURRENT_DATE AS d
        ),
        sales_today AS (
          SELECT COALESCE(SUM(final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations
           WHERE created_at::date = CURRENT_DATE
        ),
        sales_month AS (
          SELECT COALESCE(SUM(final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations
           WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        collection_today AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM payments
           WHERE created_at::date = CURRENT_DATE
        ),
        collection_month AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM payments
           WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
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
             AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        expenses_today AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM expenses
           WHERE expense_date = CURRENT_DATE
        ),
        expenses_month AS (
          SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM expenses
           WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        purchases_today AS (
          SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM purchases
           WHERE purchase_date = CURRENT_DATE
        ),
        purchases_month AS (
          SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM purchases
           WHERE DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        followups_pending AS (
          SELECT COUNT(*)::int AS count
            FROM followups
           WHERE status IN ('pending', 'overdue')
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
          CURRENT_DATE AS as_of_date
      `;
      const result = await query(sql);
      return result.rows[0] || {};
    });

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load dashboard summary", error: error.message });
  }
});

export default router;
