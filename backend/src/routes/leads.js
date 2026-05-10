import express from "express";
import { pool, query } from "../db.js";
import {
  validateFollowupPayload,
  validateLeadPayload,
  validateOperationsTaskPayload,
  validatePaymentPayload,
  validateQuotationPayload,
} from "../utils/validation.js";
import { requireRole } from "../middleware/auth.js";
import { streamQuotationPdf } from "../utils/quotationPdf.js";

const router = express.Router();

function normalizeFollowupRows(rows) {
  return rows.map((row) => ({
    ...row,
    computed_status:
      row.status === "completed"
        ? "completed"
        : row.followup_date && new Date(row.followup_date) < new Date()
          ? "overdue"
          : row.status,
  }));
}

router.get("/dashboard/stats", async (_req, res) => {
  try {
    const [overview, stageCounts, sourceCounts, followupSummary, staffPerformance, dealerSummary, operationsSummary] =
      await Promise.all([
        query(
          `WITH payment_totals AS (
             SELECT lead_id, COALESCE(SUM(amount), 0)::int AS total_paid
             FROM payments
             GROUP BY lead_id
           ),
           quotation_totals AS (
             SELECT lead_id, COALESCE(MAX(final_amount), 0)::int AS quoted_amount
             FROM quotations
             GROUP BY lead_id
           )
           SELECT
             COUNT(*)::int AS total_leads,
             COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::int AS today_walkins,
             COUNT(*) FILTER (WHERE status = 'new')::int AS new_leads,
             COUNT(*) FILTER (WHERE status = 'interested')::int AS interested_leads,
             COUNT(*) FILTER (WHERE status = 'quotation_given')::int AS quotation_leads,
             COUNT(*) FILTER (WHERE status = 'negotiation')::int AS negotiation_leads,
             COUNT(*) FILTER (WHERE status = 'converted')::int AS converted_leads,
             COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_leads,
             ROUND(
               CASE WHEN COUNT(*) = 0 THEN 0
               ELSE COUNT(*) FILTER (WHERE status = 'converted')::numeric * 100 / COUNT(*)
               END,
               1
             ) AS conversion_rate,
             COALESCE((SELECT SUM(amount)::int FROM payments WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS monthly_revenue,
             COALESCE((SELECT SUM(total_paid)::int FROM payment_totals), 0) AS collected_payments,
             COALESCE((SELECT SUM(GREATEST(q.quoted_amount - COALESCE(p.total_paid, 0), 0))::int
                      FROM quotation_totals q
                      LEFT JOIN payment_totals p ON p.lead_id = q.lead_id), 0) AS pending_collections
           FROM leads`
        ),
        query(
          `SELECT status, COUNT(*)::int AS count
           FROM leads
           GROUP BY status
           ORDER BY count DESC, status ASC`
        ),
        query(
          `SELECT lead_source, COUNT(*)::int AS count
           FROM leads
           GROUP BY lead_source
           ORDER BY count DESC, lead_source ASC`
        ),
        query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_followups,
             COUNT(*) FILTER (
               WHERE status <> 'completed'
                 AND followup_date IS NOT NULL
                 AND followup_date < CURRENT_TIMESTAMP
             )::int AS overdue_followups,
             COUNT(*) FILTER (
               WHERE status <> 'completed'
                 AND followup_date IS NOT NULL
                 AND DATE(followup_date) = CURRENT_DATE
             )::int AS todays_followups
           FROM followups`
        ),
        query(
          `SELECT
             COALESCE(u.name, 'Unassigned') AS salesperson,
             COUNT(l.id)::int AS total_leads,
             COUNT(l.id) FILTER (WHERE l.status = 'converted')::int AS converted_leads
           FROM leads l
           LEFT JOIN users u ON u.id = l.assigned_to
           GROUP BY COALESCE(u.name, 'Unassigned')
           ORDER BY converted_leads DESC, total_leads DESC, salesperson ASC`
        ),
        query(
          `SELECT
             COUNT(*)::int AS total_dealers,
             COUNT(*) FILTER (WHERE category = 'A')::int AS a_dealers,
             COALESCE(SUM(outstanding_payment), 0)::int AS dealer_outstanding
           FROM dealers`
        ),
        query(
          `SELECT
             COUNT(*) FILTER (WHERE department = 'sales')::int AS sales_leads,
             COUNT(*) FILTER (WHERE department = 'operations')::int AS operations_leads,
             (SELECT COUNT(*)::int FROM operations_tasks WHERE status IN ('pending', 'in_progress', 'delayed')) AS open_operations_tasks,
             (SELECT COUNT(*)::int FROM operations_tasks WHERE status = 'delayed') AS delayed_operations_tasks
           FROM leads`
        ),
      ]);

    return res.json({
      ...overview.rows[0],
      ...followupSummary.rows[0],
      ...dealerSummary.rows[0],
      ...operationsSummary.rows[0],
      stage_counts: stageCounts.rows,
      source_counts: sourceCounts.rows,
      staff_performance: staffPerformance.rows,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch stats", error: error.message });
  }
});

router.get("/dashboard/followups", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         f.*,
         l.name AS lead_name,
         l.phone AS lead_phone,
         l.status AS lead_status
       FROM followups f
       JOIN leads l ON l.id = f.lead_id
       ORDER BY
         CASE
           WHEN f.status <> 'completed' AND f.followup_date IS NOT NULL AND f.followup_date < CURRENT_TIMESTAMP THEN 0
           WHEN f.status = 'pending' THEN 1
           ELSE 2
         END,
         f.followup_date ASC NULLS LAST,
         f.id DESC`
    );

    return res.json(normalizeFollowupRows(result.rows));
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch follow-ups", error: error.message });
  }
});

router.get("/dashboard/operations", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         t.*,
         l.name AS lead_name,
         l.phone AS lead_phone,
         l.location AS lead_location,
         u.name AS assigned_to_name
       FROM operations_tasks t
       JOIN leads l ON l.id = t.lead_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ORDER BY
         CASE
           WHEN t.status = 'delayed' THEN 0
           WHEN t.status = 'pending' THEN 1
           WHEN t.status = 'in_progress' THEN 2
           ELSE 3
         END,
         t.scheduled_for ASC NULLS LAST,
         t.id DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch operations tasks", error: error.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         l.*,
         u.name AS assigned_to_name,
         COALESCE(payment_summary.total_paid, 0) AS total_paid,
         COALESCE(quotation_summary.latest_quote_amount, 0) AS latest_quote_amount,
         COALESCE(plumbing_summary.total_plumbing_cost, 0) AS total_plumbing_cost,
         COALESCE(plumbing_summary.plumbing_jobs_count, 0) AS plumbing_jobs_count,
         followup_summary.latest_followup,
         followup_summary.pending_followups
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN (
         SELECT lead_id, SUM(amount)::int AS total_paid
         FROM payments
         GROUP BY lead_id
       ) AS payment_summary ON payment_summary.lead_id = l.id
       LEFT JOIN (
         SELECT lead_id, MAX(final_amount)::int AS latest_quote_amount
         FROM quotations
         GROUP BY lead_id
       ) AS quotation_summary ON quotation_summary.lead_id = l.id
       LEFT JOIN (
         SELECT
           j.lead_id,
           COUNT(*)::int AS plumbing_jobs_count,
           COALESCE(SUM(j.service_charge + COALESCE(m.material_cost, 0)), 0)::int AS total_plumbing_cost
         FROM plumbing_jobs j
         LEFT JOIN (
           SELECT job_id, SUM(quantity * price)::int AS material_cost
           FROM plumbing_materials
           GROUP BY job_id
         ) m ON m.job_id = j.id
         GROUP BY j.lead_id
       ) AS plumbing_summary ON plumbing_summary.lead_id = l.id
       LEFT JOIN (
         SELECT
           lead_id,
           MAX(followup_date) AS latest_followup,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_followups
         FROM followups
         GROUP BY lead_id
       ) AS followup_summary ON followup_summary.lead_id = l.id
       ORDER BY l.created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch leads", error: error.message });
  }
});

router.post("/", async (req, res) => {
  const validation = validateLeadPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const lead = validation.value;

  try {
    const result = await query(
      `INSERT INTO leads (
         name, phone, location, department, business_unit, customer_type, requirement_category,
         requirement, budget, timeline, lead_source, status, lost_reason, assigned_to
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        lead.name,
        lead.phone,
        lead.location,
        lead.department,
        lead.business_unit,
        lead.customer_type,
        lead.requirement_category,
        lead.requirement,
        lead.budget,
        lead.timeline,
        lead.lead_source,
        lead.status,
        lead.lost_reason,
        lead.assigned_to,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create lead", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const validation = validateLeadPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const lead = validation.value;

  try {
    const result = await query(
      `UPDATE leads
       SET
        name = $1,
        phone = $2,
        location = $3,
        department = $4,
        business_unit = $5,
        customer_type = $6,
        requirement_category = $7,
        requirement = $8,
        budget = $9,
        timeline = $10,
        lead_source = $11,
        status = $12,
        lost_reason = $13,
        assigned_to = $14
       WHERE id = $15
       RETURNING *`,
      [
        lead.name,
        lead.phone,
        lead.location,
        lead.department,
        lead.business_unit,
        lead.customer_type,
        lead.requirement_category,
        lead.requirement,
        lead.budget,
        lead.timeline,
        lead.lead_source,
        lead.status,
        lead.lost_reason,
        lead.assigned_to,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update lead", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM leads WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete lead", error: error.message });
  }
});

router.get("/:id/followups", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT *
       FROM followups
       WHERE lead_id = $1
       ORDER BY followup_date DESC NULLS LAST, id DESC`,
      [id]
    );

    return res.json(normalizeFollowupRows(result.rows));
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch followups", error: error.message });
  }
});

router.post("/:id/followups", async (req, res) => {
  const { id } = req.params;
  const validation = validateFollowupPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const followup = validation.value;
  const computedStatus =
    followup.status === "completed"
      ? "completed"
      : followup.followup_date && new Date(followup.followup_date) < new Date()
        ? "overdue"
        : followup.status;

  try {
    const result = await query(
      `INSERT INTO followups (lead_id, followup_type, note, followup_date, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        followup.followup_type,
        followup.note,
        followup.followup_date,
        computedStatus,
        computedStatus === "completed" ? new Date().toISOString() : null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to add follow-up", error: error.message });
  }
});

router.put("/:leadId/followups/:followupId", async (req, res) => {
  const { leadId, followupId } = req.params;
  const validation = validateFollowupPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const followup = validation.value;
  const computedStatus =
    followup.status === "completed"
      ? "completed"
      : followup.followup_date && new Date(followup.followup_date) < new Date()
        ? "overdue"
        : followup.status;

  try {
    const result = await query(
      `UPDATE followups
       SET
         followup_type = $1,
         note = $2,
         followup_date = $3,
         status = $4,
         completed_at = $5
       WHERE id = $6 AND lead_id = $7
       RETURNING *`,
      [
        followup.followup_type,
        followup.note,
        followup.followup_date,
        computedStatus,
        computedStatus === "completed" ? new Date().toISOString() : null,
        followupId,
        leadId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Follow-up not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update follow-up", error: error.message });
  }
});

router.get("/:id/payments", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT *
       FROM payments
       WHERE lead_id = $1
       ORDER BY created_at DESC, id DESC`,
      [id]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch payments", error: error.message });
  }
});

router.get("/:id/operations-tasks", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT t.*, u.name AS assigned_to_name
       FROM operations_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.lead_id = $1
       ORDER BY t.scheduled_for DESC NULLS LAST, t.id DESC`,
      [id]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch operations tasks", error: error.message });
  }
});

router.post("/:id/operations-tasks", async (req, res) => {
  const { id } = req.params;
  const validation = validateOperationsTaskPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const task = validation.value;

  try {
    const result = await query(
      `INSERT INTO operations_tasks (
         lead_id, task_type, title, note, scheduled_for, status, assigned_to, completed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        task.task_type,
        task.title,
        task.note,
        task.scheduled_for,
        task.status,
        task.assigned_to,
        task.status === "completed" ? new Date().toISOString() : null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create operations task", error: error.message });
  }
});

router.put("/:leadId/operations-tasks/:taskId", async (req, res) => {
  const { leadId, taskId } = req.params;
  const validation = validateOperationsTaskPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const task = validation.value;

  try {
    const result = await query(
      `UPDATE operations_tasks
       SET
         task_type = $1,
         title = $2,
         note = $3,
         scheduled_for = $4,
         status = $5,
         assigned_to = $6,
         completed_at = $7
       WHERE id = $8 AND lead_id = $9
       RETURNING *`,
      [
        task.task_type,
        task.title,
        task.note,
        task.scheduled_for,
        task.status,
        task.assigned_to,
        task.status === "completed" ? new Date().toISOString() : null,
        taskId,
        leadId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Operations task not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update operations task", error: error.message });
  }
});

router.post("/:id/payments", async (req, res) => {
  const { id } = req.params;
  const validation = validatePaymentPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const payment = validation.value;

  try {
    const result = await query(
      `INSERT INTO payments (lead_id, amount, payment_type, due_date, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, payment.amount, payment.payment_type, payment.due_date, payment.note]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to add payment", error: error.message });
  }
});

router.get("/:id/quotations", async (req, res) => {
  const { id } = req.params;

  try {
    const quotationsResult = await query(
      `SELECT *
       FROM quotations
       WHERE lead_id = $1
       ORDER BY created_at DESC, id DESC`,
      [id]
    );

    const itemsResult = await query(
      `SELECT qi.*, p.design_code
       FROM quotation_items qi
       LEFT JOIN products p ON p.id = qi.product_id
       JOIN quotations q ON q.id = qi.quotation_id
       WHERE q.lead_id = $1
       ORDER BY qi.id ASC`,
      [id]
    );

    const itemsByQuotation = new Map();

    for (const item of itemsResult.rows) {
      const list = itemsByQuotation.get(item.quotation_id) || [];
      list.push(item);
      itemsByQuotation.set(item.quotation_id, list);
    }

    return res.json(
      quotationsResult.rows.map((quotation) => ({
        ...quotation,
        items: itemsByQuotation.get(quotation.id) || [],
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch quotations", error: error.message });
  }
});

router.post("/:id/quotations", async (req, res) => {
  const { id } = req.params;
  const validation = validateQuotationPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const quotation = validation.value;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const resolvedItems = [];

    for (const item of quotation.items) {
      if (!item.product_id) {
        resolvedItems.push(item);
        continue;
      }

      const productResult = await client.query(
        "SELECT * FROM products WHERE id = $1 LIMIT 1",
        [item.product_id]
      );
      const product = productResult.rows[0];

      if (!product) {
        throw new Error(`Inventory product ${item.product_id} not found`);
      }

      if (quotation.status === "approved" && product.stock_sqft < item.quantity_sqft) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      resolvedItems.push({
        ...item,
        product_name: product.name,
        tile_size: item.tile_size || product.tile_size,
        unit_price: item.unit_price || product.price_per_sqft,
        amount: item.quantity_sqft * (item.unit_price || product.price_per_sqft),
      });
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.amount, 0);
    const finalAmount = Math.max(subtotal - quotation.discount + quotation.transport_cost, 0);

    const quotationResult = await client.query(
      `INSERT INTO quotations (lead_id, subtotal, discount, transport_cost, final_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        subtotal,
        quotation.discount,
        quotation.transport_cost,
        finalAmount,
        quotation.status,
      ]
    );

    const createdQuotation = quotationResult.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, product_id, product_name, tile_size, quantity_sqft, unit_price, amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          createdQuotation.id,
          item.product_id,
          item.product_name,
          item.tile_size,
          item.quantity_sqft,
          item.unit_price,
          item.amount,
        ]
      );

      if (quotation.status === "approved" && item.product_id) {
        await client.query(
          `UPDATE products
           SET stock_sqft = stock_sqft - $1
           WHERE id = $2`,
          [item.quantity_sqft, item.product_id]
        );
      }
    }

    await client.query("COMMIT");

    return res.status(201).json({
      ...createdQuotation,
      subtotal,
      final_amount: finalAmount,
      items: resolvedItems,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Unable to create quotation", error: error.message });
  } finally {
    client.release();
  }
});

router.get("/:leadId/quotations/:quotationId/pdf", async (req, res) => {
  const { leadId, quotationId } = req.params;

  try {
    const [leadResult, quotationResult, itemsResult] = await Promise.all([
      query("SELECT * FROM leads WHERE id = $1 LIMIT 1", [leadId]),
      query("SELECT * FROM quotations WHERE id = $1 AND lead_id = $2 LIMIT 1", [
        quotationId,
        leadId,
      ]),
      query(
        "SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC",
        [quotationId]
      ),
    ]);

    const lead = leadResult.rows[0];
    const quotation = quotationResult.rows[0];

    if (!lead || !quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    streamQuotationPdf(
      {
        lead,
        quotation,
        items: itemsResult.rows,
      },
      res
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to generate quotation PDF", error: error.message });
  }
});

export default router;
