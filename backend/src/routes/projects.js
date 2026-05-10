import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import {
  validateDispatchPayload,
  validateProjectPayload,
} from "../utils/validation.js";
import { streamProjectInvoicePdf } from "../utils/invoicePdf.js";

const router = express.Router();

const projectMetricsCte = `
  WITH quotation_totals AS (
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
    SELECT
      p.lead_id,
      COALESCE(SUM(t.total_token_amount) FILTER (WHERE (t.verification_status = 'approved' AND t.status = 'pending') OR t.status = 'paid'), 0)::int AS labour_token_cost,
      COALESCE(SUM(t.total_token_amount) FILTER (WHERE t.verification_status = 'approved' AND t.status = 'pending'), 0)::int AS pending_token_amount,
      COALESCE(SUM(t.total_token_amount) FILTER (WHERE t.status = 'paid'), 0)::int AS paid_token_amount
    FROM adhesive_token_claims t
    JOIN projects p ON p.id = t.project_id
    GROUP BY p.lead_id
  ),
  dispatch_summary AS (
    SELECT
      project_id,
      COUNT(*)::int AS dispatch_count,
      COUNT(*) FILTER (WHERE status <> 'delivered')::int AS pending_dispatch_items
    FROM dispatches
    GROUP BY project_id
  ),
  plumbing_job_summary AS (
    SELECT
      lead_id,
      COUNT(*)::int AS plumbing_jobs_count,
      COUNT(*) FILTER (WHERE status <> 'completed')::int AS plumbing_jobs_pending
    FROM plumbing_jobs
    GROUP BY lead_id
  )
`;

const projectSelect = `
  ${projectMetricsCte}
  SELECT
    p.*,
    l.name AS lead_name,
    l.phone AS lead_phone,
    l.location AS lead_location,
    l.business_unit,
    l.assigned_to,
    u.name AS salesperson_name,
    COALESCE(q.tiles_sales_revenue, 0)::int AS tiles_sales_revenue,
    COALESCE(pr.plumbing_revenue, 0)::int AS plumbing_revenue,
    COALESCE(tc.labour_token_cost, 0)::int AS labour_token_cost,
    COALESCE(tc.pending_token_amount, 0)::int AS pending_token_amount,
    COALESCE(tc.paid_token_amount, 0)::int AS paid_token_amount,
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
    CASE
      WHEN (COALESCE(q.tiles_sales_revenue, 0) + COALESCE(pr.plumbing_revenue, 0)) = 0 THEN 0
      ELSE ROUND(
        (
          (
            COALESCE(q.tiles_sales_revenue, 0)
            + COALESCE(pr.plumbing_revenue, 0)
            - COALESCE(tc.labour_token_cost, 0)
            - COALESCE(pm.plumbing_material_cost, 0)
          )::numeric
          * 100
        ) / (COALESCE(q.tiles_sales_revenue, 0) + COALESCE(pr.plumbing_revenue, 0)),
        1
      )
    END AS profit_margin,
    COALESCE(ds.dispatch_count, 0)::int AS dispatch_count,
    COALESCE(ds.pending_dispatch_items, 0)::int AS pending_dispatch_items,
    COALESCE(pjs.plumbing_jobs_count, 0)::int AS plumbing_jobs_count,
    COALESCE(pjs.plumbing_jobs_pending, 0)::int AS plumbing_jobs_pending
  FROM projects p
  JOIN leads l ON l.id = p.lead_id
  LEFT JOIN users u ON u.id = l.assigned_to
  LEFT JOIN quotation_totals q ON q.lead_id = p.lead_id
  LEFT JOIN payment_totals pay ON pay.lead_id = p.lead_id
  LEFT JOIN plumbing_revenue pr ON pr.lead_id = p.lead_id
  LEFT JOIN plumbing_material_costs pm ON pm.lead_id = p.lead_id
  LEFT JOIN token_costs tc ON tc.lead_id = p.lead_id
  LEFT JOIN dispatch_summary ds ON ds.project_id = p.id
  LEFT JOIN plumbing_job_summary pjs ON pjs.lead_id = p.lead_id
`;

router.get("/", requireRole("admin", "manager", "operations", "accounts"), async (_req, res) => {
  try {
    const [projectsResult, dispatchesResult, claimsResult, claimItemsResult, summaryResult] = await Promise.all([
      query(
        `${projectSelect}
         ORDER BY p.created_at DESC, p.id DESC`
      ),
      query(
        `SELECT *
         FROM dispatches
         ORDER BY dispatch_date DESC NULLS LAST, id DESC`
      ),
      query(
        `SELECT c.*, p.lead_id, m.name AS mason_name, m.mobile AS mason_mobile, m.area AS mason_area, m.status AS mason_status
         FROM adhesive_token_claims c
         LEFT JOIN masons m ON m.id = c.mason_id
         JOIN projects p ON p.id = c.project_id
         ORDER BY c.created_at DESC, c.id DESC`
      ),
      query(
        `SELECT *
         FROM adhesive_token_items
         ORDER BY claim_id ASC, id ASC`
      ),
      query(
        `${projectMetricsCte}
         SELECT
           COUNT(*)::int AS total_projects,
           COUNT(*) FILTER (WHERE p.status = 'active')::int AS active_projects,
           COUNT(*) FILTER (WHERE p.status = 'completed')::int AS completed_projects,
           COALESCE(SUM(COALESCE(pay.received_payment, 0)), 0)::int AS total_received_payment,
           COALESCE(SUM(
             GREATEST(COALESCE(q.tiles_sales_revenue, 0) + COALESCE(pr.plumbing_revenue, 0) - COALESCE(pay.received_payment, 0), 0)
           ), 0)::int AS pending_payment,
           COALESCE(SUM(
             COALESCE(q.tiles_sales_revenue, 0) + COALESCE(pr.plumbing_revenue, 0) - COALESCE(tc.labour_token_cost, 0) - COALESCE(pm.plumbing_material_cost, 0)
           ), 0)::int AS total_net_profit,
           COALESCE(SUM(COALESCE(q.tiles_sales_revenue, 0)), 0)::int AS total_tiles_revenue,
           COALESCE(SUM(COALESCE(pr.plumbing_revenue, 0)), 0)::int AS total_plumbing_revenue,
           COALESCE(SUM(COALESCE(tc.labour_token_cost, 0)), 0)::int AS total_labour_token_cost,
           COALESCE(SUM(COALESCE(tc.pending_token_amount, 0)), 0)::int AS total_pending_token_amount,
           COALESCE(SUM(COALESCE(tc.paid_token_amount, 0)), 0)::int AS total_paid_token_amount,
           COALESCE(SUM(COALESCE(pm.plumbing_material_cost, 0)), 0)::int AS total_plumbing_material_cost,
           COALESCE(SUM(COALESCE(ds.pending_dispatch_items, 0)), 0)::int AS pending_dispatch_items,
           COALESCE(SUM(COALESCE(pjs.plumbing_jobs_pending, 0)), 0)::int AS pending_plumbing_jobs
         FROM projects p
         LEFT JOIN quotation_totals q ON q.lead_id = p.lead_id
         LEFT JOIN payment_totals pay ON pay.lead_id = p.lead_id
         LEFT JOIN plumbing_revenue pr ON pr.lead_id = p.lead_id
         LEFT JOIN plumbing_material_costs pm ON pm.lead_id = p.lead_id
         LEFT JOIN token_costs tc ON tc.lead_id = p.lead_id
         LEFT JOIN dispatch_summary ds ON ds.project_id = p.id
         LEFT JOIN plumbing_job_summary pjs ON pjs.lead_id = p.lead_id`
      ),
    ]);

    const dispatchesByProject = dispatchesResult.rows.reduce((map, item) => {
      const current = map.get(item.project_id) || [];
      current.push(item);
      map.set(item.project_id, current);
      return map;
    }, new Map());
    const claimItemsByClaim = claimItemsResult.rows.reduce((map, item) => {
      const current = map.get(item.claim_id) || [];
      current.push(item);
      map.set(item.claim_id, current);
      return map;
    }, new Map());
    const tokensByProject = claimsResult.rows.reduce((map, item) => {
      const current = map.get(item.project_id) || [];
      current.push({
        ...item,
        items: claimItemsByClaim.get(item.id) || [],
      });
      map.set(item.project_id, current);
      return map;
    }, new Map());

    return res.json({
      projects: projectsResult.rows.map((project) => ({
        ...project,
        dispatches: dispatchesByProject.get(project.id) || [],
        adhesive_tokens: tokensByProject.get(project.id) || [],
      })),
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch projects", error: error.message });
  }
});

router.get("/:id/invoice/pdf", requireRole("admin", "manager", "operations", "accounts"), async (req, res) => {
  const { id } = req.params;

  try {
    const [projectResult, dispatchesResult] = await Promise.all([
      query(
        `${projectSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [id]
      ),
      query(
        `SELECT *
         FROM dispatches
         WHERE project_id = $1
         ORDER BY dispatch_date ASC NULLS LAST, id ASC`,
        [id]
      ),
    ]);

    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    streamProjectInvoicePdf(
      {
        project: {
          ...project,
          dispatches: dispatchesResult.rows,
        },
      },
      res
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to generate invoice PDF", error: error.message });
  }
});

router.post("/", requireRole("admin", "manager", "operations"), async (req, res) => {
  const validation = validateProjectPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const project = validation.value;

  try {
    const leadResult = await query(
      "SELECT id, name, status FROM leads WHERE id = $1 LIMIT 1",
      [project.lead_id]
    );
    const lead = leadResult.rows[0];

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (lead.status !== "converted") {
      return res.status(400).json({ message: "Only converted leads can become projects" });
    }

    const existingProject = await query("SELECT id FROM projects WHERE lead_id = $1 LIMIT 1", [project.lead_id]);
    if (existingProject.rowCount > 0) {
      return res.status(409).json({ message: "A project already exists for this lead" });
    }

    const codeSeed = Date.now().toString().slice(-6);
    const projectCode = `PRJ-${project.lead_id}-${codeSeed}`;

    const result = await query(
      `INSERT INTO projects (
         lead_id, project_code, project_name, status, start_date, expected_delivery_date,
         completion_date, owner_note, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.lead_id,
        projectCode,
        project.project_name,
        project.status,
        project.start_date,
        project.expected_delivery_date,
        project.completion_date,
        project.owner_note,
        req.user.id,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create project", error: error.message });
  }
});

router.put("/:id", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { id } = req.params;
  const validation = validateProjectPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const project = validation.value;

  try {
    const result = await query(
      `UPDATE projects
       SET
         lead_id = $1,
         project_name = $2,
         status = $3,
         start_date = $4,
         expected_delivery_date = $5,
         completion_date = $6,
         owner_note = $7
       WHERE id = $8
       RETURNING *`,
      [
        project.lead_id,
        project.project_name,
        project.status,
        project.start_date,
        project.expected_delivery_date,
        project.completion_date,
        project.owner_note,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update project", error: error.message });
  }
});

router.post("/:id/dispatches", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { id } = req.params;
  const validation = validateDispatchPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const dispatch = validation.value;

  try {
    const projectResult = await query("SELECT id FROM projects WHERE id = $1 LIMIT 1", [id]);
    if (projectResult.rowCount === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const result = await query(
      `INSERT INTO dispatches (
         project_id, item_name, quantity, vehicle_number, driver_name, dispatch_date, status, note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        dispatch.item_name,
        dispatch.quantity,
        dispatch.vehicle_number,
        dispatch.driver_name,
        dispatch.dispatch_date,
        dispatch.status,
        dispatch.note,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create dispatch", error: error.message });
  }
});

router.put("/:projectId/dispatches/:dispatchId", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { projectId, dispatchId } = req.params;
  const validation = validateDispatchPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const dispatch = validation.value;

  try {
    const result = await query(
      `UPDATE dispatches
       SET
         project_id = $1,
         item_name = $2,
         quantity = $3,
         vehicle_number = $4,
         driver_name = $5,
         dispatch_date = $6,
         status = $7,
         note = $8
       WHERE id = $9 AND project_id = $10
       RETURNING *`,
      [
        projectId,
        dispatch.item_name,
        dispatch.quantity,
        dispatch.vehicle_number,
        dispatch.driver_name,
        dispatch.dispatch_date,
        dispatch.status,
        dispatch.note,
        dispatchId,
        projectId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Dispatch not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update dispatch", error: error.message });
  }
});

export default router;
