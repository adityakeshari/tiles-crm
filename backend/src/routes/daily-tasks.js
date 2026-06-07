import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateDailyTaskPayload } from "../utils/validation.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 300;
const ACTIVE_TASK_STATUSES = ["pending", "in_progress", "hold"];
const DONE_TASK_STATUSES = ["completed", "verified"];

router.use(
  requireRole(
    "admin",
    "owner",
    "manager",
    "sales",
    "operations",
    "accounts",
    "operator",
    "inventory",
    "token",
    "reports"
  )
);

function normalizeRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.filter(Boolean);
  }

  if (typeof user?.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

function hasRole(user, role) {
  return normalizeRoles(user).includes(role) || user?.role === role;
}

function hasAnyRole(user, roles) {
  return roles.some((role) => hasRole(user, role));
}

function canManageAllTasks(user) {
  return hasAnyRole(user, ["admin", "owner", "manager"]);
}

function canCreateTasks(user) {
  return canManageAllTasks(user);
}

function canVerifyTasks(user) {
  return hasAnyRole(user, ["admin", "owner"]);
}

function canDeleteTasks(user) {
  return hasAnyRole(user, ["admin", "owner"]);
}

function parseListLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

function parsePositiveInteger(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildAccessConditions(user, params) {
  const conditions = [];

  if (!canManageAllTasks(user)) {
    params.push(Number(user.id));
    conditions.push(`t.assigned_to = $${params.length}`);
  }

  return conditions;
}

function buildTaskFilters(req, params, user) {
  const conditions = buildAccessConditions(user, params);
  const view = typeof req.query.view === "string" ? req.query.view.trim() : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const priority = typeof req.query.priority === "string" ? req.query.priority.trim() : "";
  const dueDate = typeof req.query.due_date === "string" ? req.query.due_date.trim() : "";
  const assignedTo = parsePositiveInteger(req.query.assigned_to);

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length} OR t.remarks ILIKE $${params.length} OR COALESCE(assignee.name, '') ILIKE $${params.length})`
    );
  }

  if (canManageAllTasks(user) && assignedTo) {
    params.push(assignedTo);
    conditions.push(`t.assigned_to = $${params.length}`);
  }

  if (priority) {
    params.push(priority);
    conditions.push(`t.priority = $${params.length}`);
  }

  if (dueDate) {
    params.push(dueDate);
    conditions.push(`t.due_date = $${params.length}`);
  }

  if (view === "today") {
    conditions.push(`t.due_date = CURRENT_DATE`);
  } else if (view === "my") {
    params.push(Number(user.id));
    conditions.push(`t.assigned_to = $${params.length}`);
  } else if (view === "pending") {
    params.push(ACTIVE_TASK_STATUSES);
    conditions.push(`t.status = ANY($${params.length})`);
  } else if (view === "completed") {
    params.push(DONE_TASK_STATUSES);
    conditions.push(`t.status = ANY($${params.length})`);
  } else if (view === "overdue") {
    params.push(DONE_TASK_STATUSES);
    conditions.push(`t.due_date < CURRENT_DATE AND NOT (t.status = ANY($${params.length}))`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  return conditions;
}

async function getDailyTaskSummary(user) {
  const params = [];
  const conditions = buildAccessConditions(user, params);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `WITH scoped_tasks AS (
       SELECT *
       FROM daily_tasks t
       ${where}
     )
     SELECT
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE)::int AS today_total_tasks,
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status IN ('completed', 'verified'))::int AS today_completed_tasks,
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status NOT IN ('completed', 'verified'))::int AS today_pending_tasks,
       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'verified'))::int AS overdue_tasks,
       COUNT(*) FILTER (WHERE status NOT IN ('completed', 'verified'))::int AS pending_tasks,
       COUNT(*) FILTER (WHERE status IN ('completed', 'verified'))::int AS completed_tasks,
       COUNT(*)::int AS total_tasks
     FROM scoped_tasks`,
    params
  );

  return result.rows[0] || null;
}

router.get("/summary", async (req, res) => {
  try {
    const summary = await getDailyTaskSummary(req.user);
    return res.json(summary || {});
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch daily task summary", error: error.message });
  }
});

router.get("/", async (req, res) => {
  const limit = parseListLimit(req.query.limit);

  try {
    const taskParams = [];
    const conditions = buildTaskFilters(req, taskParams, req.user);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    taskParams.push(limit);

    const tasksPromise = query(
      `SELECT
         t.*,
         assignee.name AS assigned_to_name,
         assigner.name AS assigned_by_name,
         verifier.name AS verified_by_name,
         (t.due_date < CURRENT_DATE AND t.status NOT IN ('completed', 'verified')) AS is_overdue
       FROM daily_tasks t
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       LEFT JOIN users assigner ON assigner.id = t.assigned_by
       LEFT JOIN users verifier ON verifier.id = t.verified_by
       ${where}
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         CASE
           WHEN t.status = 'pending' THEN 0
           WHEN t.status = 'in_progress' THEN 1
           WHEN t.status = 'hold' THEN 2
           WHEN t.status = 'completed' THEN 3
           ELSE 4
         END,
         t.due_date ASC,
         t.due_time ASC NULLS LAST,
         t.id DESC
       LIMIT $${taskParams.length}`,
      taskParams
    );

    const summaryPromise = getDailyTaskSummary(req.user);
    const staffSummaryPromise = canManageAllTasks(req.user)
      ? query(
          `SELECT
             COALESCE(t.assigned_to, 0) AS assigned_to,
             COALESCE(u.name, 'Unassigned') AS assigned_to_name,
             COUNT(*)::int AS total_tasks,
             COUNT(*) FILTER (WHERE t.status IN ('pending', 'in_progress', 'hold'))::int AS pending_tasks,
             COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed_tasks,
             COUNT(*) FILTER (WHERE t.status = 'verified')::int AS verified_tasks,
             COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('completed', 'verified'))::int AS overdue_tasks,
             COUNT(*) FILTER (WHERE t.priority = 'urgent')::int AS urgent_tasks
           FROM daily_tasks t
           LEFT JOIN users u ON u.id = t.assigned_to
           GROUP BY COALESCE(t.assigned_to, 0), COALESCE(u.name, 'Unassigned')
           ORDER BY overdue_tasks DESC, pending_tasks DESC, assigned_to_name ASC`
        )
      : Promise.resolve({ rows: [] });

    const [tasksResult, summary, staffSummaryResult] = await Promise.all([
      tasksPromise,
      summaryPromise,
      staffSummaryPromise,
    ]);

    return res.json({
      tasks: tasksResult.rows,
      summary: summary || {},
      staffSummary: staffSummaryResult.rows || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch daily tasks", error: error.message });
  }
});

router.post("/", async (req, res) => {
  if (!canCreateTasks(req.user)) {
    return res.status(403).json({ message: "You do not have access to create daily tasks" });
  }

  const validation = validateDailyTaskPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const task = validation.value;

  if (task.status === "verified" && !canVerifyTasks(req.user)) {
    return res.status(403).json({ message: "Only admin can verify tasks" });
  }

  try {
    const result = await query(
      `INSERT INTO daily_tasks (
         title,
         description,
         assigned_to,
         assigned_by,
         priority,
         due_date,
         due_time,
         status,
         remarks,
         completed_at,
         verified_by,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        task.title,
        task.description,
        task.assigned_to,
        req.user.id,
        task.priority,
        task.due_date,
        task.due_time,
        task.status,
        task.remarks,
        DONE_TASK_STATUSES.includes(task.status) ? new Date().toISOString() : null,
        task.status === "verified" ? req.user.id : null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create daily task", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existingResult = await query("SELECT * FROM daily_tasks WHERE id = $1 LIMIT 1", [id]);

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Daily task not found" });
    }

    const existingTask = existingResult.rows[0];
    const isAssignedUser = Number(existingTask.assigned_to || 0) === Number(req.user.id || 0);
    const canManage = canManageAllTasks(req.user);

    if (!canManage && !isAssignedUser) {
      return res.status(403).json({ message: "You do not have access to update this daily task" });
    }

    const payloadToValidate = canManage
      ? req.body
      : {
          ...existingTask,
          status: req.body.status ?? existingTask.status,
          remarks: req.body.remarks ?? existingTask.remarks,
          due_date: existingTask.due_date ? String(existingTask.due_date).slice(0, 10) : "",
          due_time: existingTask.due_time ? String(existingTask.due_time).slice(0, 5) : "",
        };

    const validation = validateDailyTaskPayload(payloadToValidate);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const task = validation.value;

    if (task.status === "verified" && !canVerifyTasks(req.user)) {
      return res.status(403).json({ message: "Only admin can verify tasks" });
    }

    const completedAt = DONE_TASK_STATUSES.includes(task.status)
      ? existingTask.completed_at || new Date().toISOString()
      : null;
    const verifiedBy = task.status === "verified" ? req.user.id : null;

    const result = await query(
      `UPDATE daily_tasks
       SET
         title = $1,
         description = $2,
         assigned_to = $3,
         priority = $4,
         due_date = $5,
         due_time = $6,
         status = $7,
         remarks = $8,
         completed_at = $9,
         verified_by = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        canManage ? task.title : existingTask.title,
        canManage ? task.description : existingTask.description,
        canManage ? task.assigned_to : existingTask.assigned_to,
        canManage ? task.priority : existingTask.priority,
        canManage ? task.due_date : existingTask.due_date,
        canManage ? task.due_time : existingTask.due_time,
        task.status,
        task.remarks,
        completedAt,
        verifiedBy,
        id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update daily task", error: error.message });
  }
});

router.put("/:id/verify", async (req, res) => {
  const { id } = req.params;

  if (!canVerifyTasks(req.user)) {
    return res.status(403).json({ message: "Only admin can verify daily tasks" });
  }

  try {
    const result = await query(
      `UPDATE daily_tasks
       SET
         status = 'verified',
         verified_by = $1,
         completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Daily task not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to verify daily task", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!canDeleteTasks(req.user)) {
    return res.status(403).json({ message: "Only admin can delete daily tasks" });
  }

  try {
    const result = await query("DELETE FROM daily_tasks WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Daily task not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete daily task", error: error.message });
  }
});

export default router;
