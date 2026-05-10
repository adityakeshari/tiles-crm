import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateComplaintPayload } from "../utils/validation.js";

const router = express.Router();

async function createUserNotification(userId, { title, message, link_type, link_id }) {
  if (!userId) {
    return;
  }

  await query(
    `INSERT INTO app_notifications (user_id, title, message, link_type, link_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, title, message, link_type, link_id]
  );
}

router.get("/", async (_req, res) => {
  try {
    const [complaintsResult, summaryResult] = await Promise.all([
      query(
        `SELECT
           c.*,
           l.name AS lead_name,
           u.name AS assigned_to_name,
           t.title AS operation_task_title,
           t.status AS operation_task_status
         FROM complaints c
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN users u ON u.id = c.assigned_to
         LEFT JOIN operations_tasks t ON t.id = c.operation_task_id
         ORDER BY
           CASE c.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END,
           c.created_at DESC,
           c.id DESC`
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_complaints,
           COUNT(*) FILTER (WHERE business_unit = 'plumbing')::int AS plumbing_complaints,
           COUNT(*) FILTER (WHERE business_unit = 'tiles')::int AS tiles_complaints,
           COUNT(*) FILTER (WHERE status IN ('open', 'assigned', 'in_progress', 'waiting_customer'))::int AS open_complaints,
           COUNT(*) FILTER (WHERE priority = 'urgent')::int AS urgent_complaints,
           COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS closed_complaints
         FROM complaints`
      ),
    ]);

    return res.json({
      complaints: complaintsResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch complaints", error: error.message });
  }
});

router.post("/", async (req, res) => {
  const validation = validateComplaintPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const complaint = validation.value;

  try {
    const result = await query(
      `INSERT INTO complaints (
         lead_id, customer_name, phone, location, business_unit, category, priority, status,
         title, description, resolution_note, due_date, assigned_to, created_by, resolved_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        complaint.lead_id,
        complaint.customer_name,
        complaint.phone,
        complaint.location,
        complaint.business_unit,
        complaint.category,
        complaint.priority,
        complaint.status,
        complaint.title,
        complaint.description,
        complaint.resolution_note,
        complaint.due_date,
        complaint.assigned_to,
        req.user.id,
        complaint.status === "resolved" || complaint.status === "closed"
          ? new Date().toISOString()
          : null,
      ]
    );

    const createdComplaint = result.rows[0];

    if (complaint.assigned_to) {
      await createUserNotification(complaint.assigned_to, {
        title: `${complaint.business_unit === "plumbing" ? "Plumbing" : "Service"} complaint assigned`,
        message: `${complaint.customer_name} | ${complaint.title}`,
        link_type: "complaint",
        link_id: createdComplaint.id,
      });
    }

    return res.status(201).json(createdComplaint);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create complaint", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const validation = validateComplaintPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const complaint = validation.value;

  try {
    const currentResult = await query("SELECT * FROM complaints WHERE id = $1 LIMIT 1", [id]);
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const result = await query(
      `UPDATE complaints
       SET
         lead_id = $1,
         customer_name = $2,
         phone = $3,
         location = $4,
         business_unit = $5,
         category = $6,
         priority = $7,
         status = $8,
         title = $9,
         description = $10,
         resolution_note = $11,
         due_date = $12,
         assigned_to = $13,
         resolved_at = $14
       WHERE id = $15
       RETURNING *`,
      [
        complaint.lead_id,
        complaint.customer_name,
        complaint.phone,
        complaint.location,
        complaint.business_unit,
        complaint.category,
        complaint.priority,
        complaint.status,
        complaint.title,
        complaint.description,
        complaint.resolution_note,
        complaint.due_date,
        complaint.assigned_to,
        complaint.status === "resolved" || complaint.status === "closed"
          ? new Date().toISOString()
          : null,
        id,
      ]
    );

    const updatedComplaint = result.rows[0];

    if (complaint.assigned_to && complaint.assigned_to !== current.assigned_to) {
      await createUserNotification(complaint.assigned_to, {
        title: `${complaint.business_unit === "plumbing" ? "Plumbing" : "Service"} complaint assigned`,
        message: `${complaint.customer_name} | ${complaint.title}`,
        link_type: "complaint",
        link_id: updatedComplaint.id,
      });
    }

    return res.json(updatedComplaint);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update complaint", error: error.message });
  }
});

router.post("/:id/create-operations-task", async (req, res) => {
  const { id } = req.params;

  try {
    const complaintResult = await query(
      `SELECT *
       FROM complaints
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const complaint = complaintResult.rows[0];

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.operation_task_id) {
      return res.status(400).json({ message: "Operations task already linked to this complaint" });
    }

    if (!complaint.lead_id) {
      return res.status(400).json({ message: "Link this complaint to a lead before creating an operations task" });
    }

    const taskType =
      complaint.category === "installation_defect" || complaint.category === "tile_breakage"
        ? "installation"
        : "site_visit";
    const taskStatus = complaint.assigned_to ? "assigned" : "pending";

    const operationsResult = await query(
      `INSERT INTO operations_tasks (
         lead_id, task_type, title, note, scheduled_for, status, assigned_to, completed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
       RETURNING *`,
      [
        complaint.lead_id,
        taskType,
        `Complaint visit: ${complaint.title}`,
        `${complaint.description}\n\nComplaint #${complaint.id} | ${complaint.customer_name} | ${complaint.phone}`,
        complaint.due_date,
        taskStatus === "assigned" ? "pending" : "pending",
        complaint.assigned_to,
      ]
    );

    const createdTask = operationsResult.rows[0];

    await query(
      `UPDATE complaints
       SET
         operation_task_id = $1,
         status = CASE
           WHEN status = 'open' THEN 'assigned'
           ELSE status
         END
       WHERE id = $2`,
      [createdTask.id, id]
    );

    if (complaint.assigned_to) {
      await createUserNotification(complaint.assigned_to, {
        title: "Complaint task moved to operations",
        message: `${complaint.customer_name} | ${complaint.title}`,
        link_type: "operations_task",
        link_id: createdTask.id,
      });
    }

    return res.status(201).json(createdTask);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to create operations task from complaint",
      error: error.message,
    });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM complaints WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete complaint", error: error.message });
  }
});

export default router;
