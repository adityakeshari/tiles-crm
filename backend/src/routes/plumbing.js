import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import {
  validatePlumberPayload,
  validatePlumbingJobPayload,
  validatePlumbingMaterialPayload,
} from "../utils/validation.js";

const router = express.Router();

const jobSelect = `
  SELECT
    j.*,
    l.name AS lead_name,
    l.phone AS lead_phone,
    l.location AS lead_location,
    p.name AS plumber_name,
    p.phone AS plumber_phone,
    p.area AS plumber_area,
    COALESCE(material_summary.material_cost, 0)::int AS material_cost,
    COALESCE(material_summary.material_count, 0)::int AS material_count,
    (j.service_charge + COALESCE(material_summary.material_cost, 0))::int AS total_cost
  FROM plumbing_jobs j
  JOIN leads l ON l.id = j.lead_id
  LEFT JOIN plumbers p ON p.id = j.plumber_id
  LEFT JOIN (
    SELECT
      job_id,
      COALESCE(SUM(quantity * price), 0)::int AS material_cost,
      COUNT(*)::int AS material_count
    FROM plumbing_materials
    GROUP BY job_id
  ) AS material_summary ON material_summary.job_id = j.id
`;

function mapMaterialsByJob(rows) {
  return rows.reduce((accumulator, material) => {
    const current = accumulator.get(material.job_id) || [];
    current.push(material);
    accumulator.set(material.job_id, current);
    return accumulator;
  }, new Map());
}

router.get("/", async (_req, res) => {
  try {
    const [plumbersResult, jobsResult, summaryResult] = await Promise.all([
      query("SELECT * FROM plumbers ORDER BY name ASC"),
      query(
        `${jobSelect}
         ORDER BY
           CASE j.status
             WHEN 'ongoing' THEN 1
             WHEN 'pending' THEN 2
             WHEN 'on_hold' THEN 3
             ELSE 4
           END,
           j.scheduled_for ASC NULLS LAST,
           j.id DESC`
      ),
      query(
        `WITH job_costs AS (
           SELECT
             j.id,
             j.status,
             (j.service_charge + COALESCE(m.material_cost, 0))::int AS total_cost
           FROM plumbing_jobs j
           LEFT JOIN (
             SELECT job_id, SUM(quantity * price)::int AS material_cost
             FROM plumbing_materials
             GROUP BY job_id
           ) m ON m.job_id = j.id
         )
         SELECT
           (SELECT COUNT(*)::int FROM plumbers) AS total_plumbers,
           COUNT(*)::int AS total_jobs,
           COUNT(*) FILTER (WHERE status = 'ongoing')::int AS ongoing_jobs,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_jobs,
           COALESCE(SUM(total_cost), 0)::int AS total_plumbing_value
         FROM job_costs`
      ),
    ]);

    return res.json({
      plumbers: plumbersResult.rows,
      jobs: jobsResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch plumbing dashboard", error: error.message });
  }
});

router.get("/lead/:leadId", async (req, res) => {
  const { leadId } = req.params;

  try {
    const [jobsResult, materialsResult] = await Promise.all([
      query(
        `${jobSelect}
         WHERE j.lead_id = $1
         ORDER BY j.created_at DESC, j.id DESC`,
        [leadId]
      ),
      query(
        `SELECT *
         FROM plumbing_materials
         WHERE job_id IN (
           SELECT id FROM plumbing_jobs WHERE lead_id = $1
         )
         ORDER BY created_at DESC, id DESC`,
        [leadId]
      ),
    ]);

    const materialsByJob = mapMaterialsByJob(materialsResult.rows);
    const jobs = jobsResult.rows.map((job) => ({
      ...job,
      materials: materialsByJob.get(job.id) || [],
    }));

    return res.json(jobs);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch plumbing jobs", error: error.message });
  }
});

router.post("/plumbers", requireRole("admin", "manager", "operations"), async (req, res) => {
  const validation = validatePlumberPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const plumber = validation.value;

  try {
    const result = await query(
      `INSERT INTO plumbers (name, phone, area)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [plumber.name, plumber.phone, plumber.area]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create plumber", error: error.message });
  }
});

router.put("/plumbers/:id", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { id } = req.params;
  const validation = validatePlumberPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const plumber = validation.value;

  try {
    const result = await query(
      `UPDATE plumbers
       SET name = $1, phone = $2, area = $3
       WHERE id = $4
       RETURNING *`,
      [plumber.name, plumber.phone, plumber.area, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Plumber not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update plumber", error: error.message });
  }
});

router.delete("/plumbers/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM plumbers WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Plumber not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete plumber", error: error.message });
  }
});

router.post("/jobs", requireRole("admin", "manager", "operations"), async (req, res) => {
  const validation = validatePlumbingJobPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const job = validation.value;

  try {
    const result = await query(
      `INSERT INTO plumbing_jobs (
         lead_id, plumber_id, work_type, status, service_charge, scheduled_for, note, completed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        job.lead_id,
        job.plumber_id,
        job.work_type,
        job.status,
        job.service_charge,
        job.scheduled_for,
        job.note,
        job.status === "completed" ? new Date().toISOString() : null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create plumbing job", error: error.message });
  }
});

router.put("/jobs/:id", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { id } = req.params;
  const validation = validatePlumbingJobPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const job = validation.value;

  try {
    const result = await query(
      `UPDATE plumbing_jobs
       SET
         lead_id = $1,
         plumber_id = $2,
         work_type = $3,
         status = $4,
         service_charge = $5,
         scheduled_for = $6,
         note = $7,
         completed_at = CASE
           WHEN $4 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
           ELSE NULL
         END
       WHERE id = $8
       RETURNING *`,
      [
        job.lead_id,
        job.plumber_id,
        job.work_type,
        job.status,
        job.service_charge,
        job.scheduled_for,
        job.note,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Plumbing job not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update plumbing job", error: error.message });
  }
});

router.post("/jobs/:id/materials", requireRole("admin", "manager", "operations"), async (req, res) => {
  const { id } = req.params;
  const validation = validatePlumbingMaterialPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const material = validation.value;

  try {
    const jobResult = await query("SELECT id FROM plumbing_jobs WHERE id = $1", [id]);

    if (jobResult.rowCount === 0) {
      return res.status(404).json({ message: "Plumbing job not found" });
    }

    const result = await query(
      `INSERT INTO plumbing_materials (job_id, item_name, quantity, unit, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, material.item_name, material.quantity, material.unit, material.price]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to add plumbing material", error: error.message });
  }
});

export default router;
