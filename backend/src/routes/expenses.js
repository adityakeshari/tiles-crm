import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateExpensePayload } from "../utils/validation.js";

const router = express.Router();

router.use(requireRole("admin", "manager", "accounts"));

router.get("/", async (_req, res) => {
  try {
    const [expensesResult, summaryResult] = await Promise.all([
      query(
        `SELECT e.*, u.name AS created_by_name
         FROM expenses e
         LEFT JOIN users u ON u.id = e.created_by
         ORDER BY e.expense_date DESC, e.id DESC`
      ),
      query(
        `WITH project_profit AS (
           SELECT
             p.id,
             (
               COALESCE(q.tiles_sales_revenue, 0)
               + COALESCE(pr.plumbing_revenue, 0)
               - COALESCE(tc.labour_token_cost, 0)
               - COALESCE(pm.plumbing_material_cost, 0)
             )::int AS net_profit
           FROM projects p
           LEFT JOIN (
             SELECT lead_id, MAX(final_amount)::int AS tiles_sales_revenue
             FROM quotations
             GROUP BY lead_id
           ) q ON q.lead_id = p.lead_id
           LEFT JOIN (
             SELECT lead_id, SUM(service_charge)::int AS plumbing_revenue
             FROM plumbing_jobs
             GROUP BY lead_id
           ) pr ON pr.lead_id = p.lead_id
           LEFT JOIN (
             SELECT j.lead_id, SUM(m.quantity * m.price)::int AS plumbing_material_cost
             FROM plumbing_jobs j
             LEFT JOIN plumbing_materials m ON m.job_id = j.id
             GROUP BY j.lead_id
           ) pm ON pm.lead_id = p.lead_id
           LEFT JOIN (
             SELECT redeemed_lead_id AS lead_id, SUM(token_value)::int AS labour_token_cost
             FROM scheme_tokens
             WHERE status = 'redeemed' AND redeemed_lead_id IS NOT NULL
             GROUP BY redeemed_lead_id
           ) tc ON tc.lead_id = p.lead_id
         ),
         monthly_expenses AS (
           SELECT
             category,
             COALESCE(SUM(amount), 0)::int AS amount
           FROM expenses
           WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
           GROUP BY category
         )
         SELECT
           COALESCE((SELECT SUM(net_profit)::int FROM project_profit), 0)::int AS gross_project_profit,
           COALESCE((SELECT SUM(amount)::int FROM expenses WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)), 0)::int AS monthly_expenses,
           COALESCE((SELECT SUM(net_profit)::int FROM project_profit), 0)::int
             - COALESCE((SELECT SUM(amount)::int FROM expenses WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)), 0)::int
             AS monthly_net_profit_after_expenses,
           COALESCE((SELECT json_agg(monthly_expenses.*) FROM monthly_expenses), '[]'::json) AS monthly_breakdown`
      ),
    ]);

    return res.json({
      expenses: expensesResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch expenses", error: error.message });
  }
});

router.post("/", async (req, res) => {
  const validation = validateExpensePayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const expense = validation.value;

  try {
    const result = await query(
      `INSERT INTO expenses (category, expense_date, amount, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [expense.category, expense.expense_date, expense.amount, expense.note, req.user.id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create expense", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const validation = validateExpensePayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const expense = validation.value;

  try {
    const result = await query(
      `UPDATE expenses
       SET category = $1, expense_date = $2, amount = $3, note = $4
       WHERE id = $5
       RETURNING *`,
      [expense.category, expense.expense_date, expense.amount, expense.note, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update expense", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM expenses WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete expense", error: error.message });
  }
});

export default router;
