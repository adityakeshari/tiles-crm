import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireRole("admin", "manager", "accounts"));

function csvEscape(value) {
  const normalized = value === null || typeof value === "undefined" ? "" : String(value);
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}

function sendCsv(res, filename, columns, rows) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(","));
  const csv = [header, ...lines].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(csv);
}

router.get("/leads.csv", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         l.id,
         l.name,
         l.phone,
         l.location,
         l.department,
         l.business_unit,
         l.customer_type,
         l.requirement_category,
         l.lead_source,
         l.status,
         l.budget,
         COALESCE(u.name, 'Unassigned') AS assigned_to_name,
         COALESCE(payment_summary.total_paid, 0)::int AS total_paid,
         COALESCE(quotation_summary.latest_quote_amount, 0)::int AS latest_quote_amount,
         l.created_at
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN (
         SELECT lead_id, SUM(amount)::int AS total_paid
         FROM payments
         GROUP BY lead_id
       ) payment_summary ON payment_summary.lead_id = l.id
       LEFT JOIN (
         SELECT lead_id, MAX(final_amount)::int AS latest_quote_amount
         FROM quotations
         GROUP BY lead_id
       ) quotation_summary ON quotation_summary.lead_id = l.id
       ORDER BY l.created_at DESC`
    );

    sendCsv(
      res,
      "leads-export.csv",
      [
        { key: "id", label: "Lead ID" },
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "location", label: "Location" },
        { key: "department", label: "Department" },
        { key: "business_unit", label: "Business Unit" },
        { key: "customer_type", label: "Customer Type" },
        { key: "requirement_category", label: "Requirement Category" },
        { key: "lead_source", label: "Lead Source" },
        { key: "status", label: "Status" },
        { key: "budget", label: "Budget" },
        { key: "assigned_to_name", label: "Assigned To" },
        { key: "total_paid", label: "Total Paid" },
        { key: "latest_quote_amount", label: "Latest Quote Amount" },
        { key: "created_at", label: "Created At" },
      ],
      result.rows
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to export leads", error: error.message });
  }
});

router.get("/payments.csv", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         p.id,
         p.lead_id,
         l.name AS lead_name,
         l.phone AS lead_phone,
         p.amount,
         p.payment_type,
         p.due_date,
         p.note,
         p.created_at
       FROM payments p
       JOIN leads l ON l.id = p.lead_id
       ORDER BY p.created_at DESC, p.id DESC`
    );

    sendCsv(
      res,
      "payments-export.csv",
      [
        { key: "id", label: "Payment ID" },
        { key: "lead_id", label: "Lead ID" },
        { key: "lead_name", label: "Lead Name" },
        { key: "lead_phone", label: "Lead Phone" },
        { key: "amount", label: "Amount" },
        { key: "payment_type", label: "Payment Type" },
        { key: "due_date", label: "Due Date" },
        { key: "note", label: "Note" },
        { key: "created_at", label: "Created At" },
      ],
      result.rows
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to export payments", error: error.message });
  }
});

router.get("/projects.csv", async (_req, res) => {
  try {
    const result = await query(
      `WITH quotation_totals AS (
         SELECT lead_id, COALESCE(MAX(final_amount), 0)::int AS tiles_sales_revenue
         FROM quotations
         GROUP BY lead_id
       ),
       payment_totals AS (
         SELECT lead_id, COALESCE(SUM(amount), 0)::int AS received_payment
         FROM payments
         GROUP BY lead_id
       ),
       plumbing_revenue AS (
         SELECT lead_id, COALESCE(SUM(service_charge), 0)::int AS plumbing_revenue
         FROM plumbing_jobs
         GROUP BY lead_id
       ),
       plumbing_material_costs AS (
         SELECT
           j.lead_id,
           COALESCE(SUM(m.quantity * m.price), 0)::int AS plumbing_material_cost
         FROM plumbing_jobs j
         LEFT JOIN plumbing_materials m ON m.job_id = j.id
         GROUP BY j.lead_id
       ),
       token_costs AS (
         SELECT redeemed_lead_id AS lead_id, COALESCE(SUM(token_value), 0)::int AS labour_token_cost
         FROM scheme_tokens
         WHERE status = 'redeemed' AND redeemed_lead_id IS NOT NULL
         GROUP BY redeemed_lead_id
       )
       SELECT
         p.id,
         p.project_code,
         p.project_name,
         p.status,
         l.name AS lead_name,
         l.phone AS lead_phone,
         l.location AS lead_location,
         COALESCE(q.tiles_sales_revenue, 0)::int AS tiles_sales_revenue,
         COALESCE(pr.plumbing_revenue, 0)::int AS plumbing_revenue,
         COALESCE(tc.labour_token_cost, 0)::int AS labour_token_cost,
         COALESCE(pm.plumbing_material_cost, 0)::int AS plumbing_material_cost,
         COALESCE(pay.received_payment, 0)::int AS received_payment,
         GREATEST(
           COALESCE(q.tiles_sales_revenue, 0) + COALESCE(pr.plumbing_revenue, 0) - COALESCE(pay.received_payment, 0),
           0
         )::int AS pending_payment,
         (
           COALESCE(q.tiles_sales_revenue, 0)
           + COALESCE(pr.plumbing_revenue, 0)
           - COALESCE(tc.labour_token_cost, 0)
           - COALESCE(pm.plumbing_material_cost, 0)
         )::int AS net_profit,
         p.created_at
       FROM projects p
       JOIN leads l ON l.id = p.lead_id
       LEFT JOIN quotation_totals q ON q.lead_id = p.lead_id
       LEFT JOIN payment_totals pay ON pay.lead_id = p.lead_id
       LEFT JOIN plumbing_revenue pr ON pr.lead_id = p.lead_id
       LEFT JOIN plumbing_material_costs pm ON pm.lead_id = p.lead_id
       LEFT JOIN token_costs tc ON tc.lead_id = p.lead_id
       ORDER BY p.created_at DESC, p.id DESC`
    );

    sendCsv(
      res,
      "projects-export.csv",
      [
        { key: "id", label: "Project ID" },
        { key: "project_code", label: "Project Code" },
        { key: "project_name", label: "Project Name" },
        { key: "status", label: "Status" },
        { key: "lead_name", label: "Lead Name" },
        { key: "lead_phone", label: "Lead Phone" },
        { key: "lead_location", label: "Lead Location" },
        { key: "tiles_sales_revenue", label: "Tiles Revenue" },
        { key: "plumbing_revenue", label: "Plumbing Revenue" },
        { key: "labour_token_cost", label: "Labour Token Cost" },
        { key: "plumbing_material_cost", label: "Plumbing Material Cost" },
        { key: "received_payment", label: "Received Payment" },
        { key: "pending_payment", label: "Pending Payment" },
        { key: "net_profit", label: "Net Profit" },
        { key: "created_at", label: "Created At" },
      ],
      result.rows
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to export projects", error: error.message });
  }
});

export default router;
