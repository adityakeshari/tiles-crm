import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateDailyReportQuery, validateDateRangeQuery } from "../utils/validation.js";

const router = express.Router();

// Owner / finance / reporting roles. Operators read their own purchases via the purchases route.
router.use(requireRole("admin", "manager", "accounts", "reports", "operations"));

router.get("/daily", async (req, res) => {
  const validation = validateDailyReportQuery(req.query);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { date } = validation.value;

  try {
    const result = await query(
      `WITH
         sales AS (
           SELECT COALESCE(SUM(final_amount), 0)::numeric AS amount,
                  COUNT(*)::int AS count
             FROM quotations
            WHERE created_at::date = $1::date
         ),
         collection AS (
           SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                  COUNT(*)::int AS count
             FROM payments
            WHERE created_at::date = $1::date
         ),
         expense AS (
           SELECT COALESCE(SUM(amount), 0)::numeric AS amount,
                  COUNT(*)::int AS count
             FROM expenses
            WHERE expense_date = $1::date
         ),
         purchase AS (
           SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount,
                  COUNT(*)::int AS count
             FROM purchases
            WHERE purchase_date = $1::date
         ),
         tokens AS (
           SELECT COALESCE(SUM(total_token_amount), 0)::numeric AS amount,
                  COUNT(*)::int AS count
             FROM adhesive_token_claims
            WHERE created_at::date = $1::date
         ),
         followups AS (
           SELECT COUNT(*)::int AS count
             FROM followups
            WHERE followup_date::date = $1::date
              AND status IN ('pending', 'overdue')
         ),
         cash_in AS (
           SELECT COALESCE(SUM(amount), 0)::numeric AS amount FROM collection
         ),
         cash_out AS (
           SELECT
             (COALESCE((SELECT amount FROM expense), 0)
              + COALESCE((SELECT amount FROM purchase), 0))::numeric AS amount
         )
       SELECT
         $1::date AS report_date,
         (SELECT row_to_json(t) FROM sales t)       AS sales,
         (SELECT row_to_json(t) FROM collection t)  AS collection,
         (SELECT row_to_json(t) FROM expense t)     AS expense,
         (SELECT row_to_json(t) FROM purchase t)    AS purchase,
         (SELECT row_to_json(t) FROM tokens t)      AS tokens,
         (SELECT row_to_json(t) FROM followups t)   AS followups,
         (SELECT amount FROM cash_in)               AS cash_in,
         (SELECT amount FROM cash_out)              AS cash_out,
         ((SELECT amount FROM cash_in) - (SELECT amount FROM cash_out))::numeric AS net_cash`,
      [date]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch daily report", error: error.message });
  }
});

router.get("/sales", async (req, res) => {
  const validation = validateDateRangeQuery(req.query);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { from, to } = validation.value;
  const params = [];
  const conds = [];

  if (from) {
    params.push(from);
    conds.push(`q.created_at::date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conds.push(`q.created_at::date <= $${params.length}::date`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  try {
    const result = await query(
      `SELECT q.id, q.lead_id, q.subtotal, q.discount, q.transport_cost, q.final_amount,
              q.status, q.created_at,
              l.name AS lead_name, l.phone AS lead_phone
         FROM quotations q
         LEFT JOIN leads l ON l.id = q.lead_id
         ${where}
         ORDER BY q.created_at DESC
         LIMIT 1000`,
      params
    );
    return res.json({ rows: result.rows, count: result.rowCount });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch sales report", error: error.message });
  }
});

router.get("/collection", async (req, res) => {
  const validation = validateDateRangeQuery(req.query);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { from, to } = validation.value;
  const params = [];
  const conds = [];

  if (from) {
    params.push(from);
    conds.push(`p.created_at::date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conds.push(`p.created_at::date <= $${params.length}::date`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  try {
    const result = await query(
      `SELECT p.id, p.lead_id, p.amount, p.payment_type, p.due_date, p.note, p.created_at,
              l.name AS lead_name, l.phone AS lead_phone
         FROM payments p
         LEFT JOIN leads l ON l.id = p.lead_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT 1000`,
      params
    );
    return res.json({ rows: result.rows, count: result.rowCount });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch collection report", error: error.message });
  }
});

router.get("/customer-pending", async (_req, res) => {
  try {
    const result = await query(
      `SELECT l.id,
              l.name,
              l.phone,
              l.location,
              COALESCE(q.final_amount, 0)::numeric AS quoted_amount,
              COALESCE(p.paid_total, 0)::numeric AS paid_amount,
              GREATEST(COALESCE(q.final_amount, 0) - COALESCE(p.paid_total, 0), 0)::numeric AS pending_amount,
              l.status
         FROM leads l
         LEFT JOIN LATERAL (
           SELECT final_amount FROM quotations WHERE lead_id = l.id ORDER BY id DESC LIMIT 1
         ) q ON true
         LEFT JOIN (
           SELECT lead_id, SUM(amount)::numeric AS paid_total FROM payments GROUP BY lead_id
         ) p ON p.lead_id = l.id
         WHERE l.status IN ('converted', 'quotation_given', 'negotiation', 'interested')
           AND GREATEST(COALESCE(q.final_amount, 0) - COALESCE(p.paid_total, 0), 0) > 0
         ORDER BY pending_amount DESC
         LIMIT 500`
    );
    return res.json({ rows: result.rows, count: result.rowCount });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to fetch customer pending report", error: error.message });
  }
});

router.get("/token", async (req, res) => {
  const status = req.query.status === "paid" ? "paid" : req.query.status === "rejected" ? "rejected" : "pending";

  try {
    const result = await query(
      `SELECT c.id, c.invoice_number, c.sale_date, c.site_name, c.customer_name,
              c.adhesive_company, c.adhesive_type, c.sold_bag_quantity, c.claimed_bag_quantity,
              c.total_token_amount, c.status, c.verification_status, c.payment_date,
              c.created_at,
              m.id AS mason_id, m.name AS mason_name, m.mobile AS mason_mobile, m.status AS mason_status
         FROM adhesive_token_claims c
         LEFT JOIN masons m ON m.id = c.mason_id
         WHERE c.status = $1
         ORDER BY c.created_at DESC
         LIMIT 1000`,
      [status]
    );
    return res.json({ rows: result.rows, count: result.rowCount, status });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch token report", error: error.message });
  }
});

router.get("/mason-token-summary", async (_req, res) => {
  try {
    const result = await query(
      `SELECT m.id, m.name, m.mobile, m.status,
              COUNT(c.id)::int AS total_claims,
              COUNT(c.id) FILTER (WHERE c.status = 'pending')::int AS pending_claims,
              COUNT(c.id) FILTER (WHERE c.status = 'paid')::int AS paid_claims,
              COALESCE(SUM(c.total_token_amount), 0)::numeric AS total_amount,
              COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'pending'), 0)::numeric AS pending_amount,
              COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::numeric AS paid_amount
         FROM masons m
         LEFT JOIN adhesive_token_claims c ON c.mason_id = m.id
        GROUP BY m.id
        HAVING COUNT(c.id) > 0
        ORDER BY total_amount DESC
        LIMIT 500`
    );
    return res.json({ rows: result.rows, count: result.rowCount });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to fetch mason-wise token summary", error: error.message });
  }
});

export default router;
