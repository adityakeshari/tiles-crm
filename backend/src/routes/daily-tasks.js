import express from "express";
import { pool, query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateDailyTaskPayload, validateExternalDailyTaskPayload } from "../utils/validation.js";

const router = express.Router();
const externalRouter = express.Router();
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

async function runDbQuery(executor, text, params = []) {
  if (typeof executor === "function") {
    return executor(text, params);
  }

  return executor.query(text, params);
}

function getTaskApiKeyConfig() {
  return process.env.TASK_API_KEY || process.env.INTERNAL_API_KEY || process.env.CRM_OWNER_SUMMARY_API_KEY || "";
}

function requireTaskApiKey(req, res, next) {
  const configuredKey = getTaskApiKeyConfig();

  if (!configuredKey) {
    return res.status(503).json({ message: "Task external API key is not configured" });
  }

  const providedKey =
    req.headers["x-task-api-key"] ||
    req.headers["x-internal-api-key"] ||
    (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.replace("Bearer ", "")
      : "");

  if (typeof providedKey !== "string" || providedKey !== configuredKey) {
    return res.status(401).json({ message: "Invalid task API key" });
  }

  next();
}

async function ensureAssignedUserExists(executor, assignedTo) {
  const userResult = await runDbQuery(
    executor,
    "SELECT id, name, role, roles FROM users WHERE id = $1 LIMIT 1",
    [assignedTo]
  );

  if (userResult.rowCount === 0) {
    return { ok: false, status: 400, message: "Assigned user does not exist" };
  }

  return { ok: true, user: userResult.rows[0] };
}

async function findExistingTaskDuplicate(executor, { title, assigned_to, due_date }) {
  const duplicateResult = await runDbQuery(
    executor,
    `SELECT id, title, assigned_to, due_date, status, source
     FROM daily_tasks
     WHERE LOWER(BTRIM(title)) = LOWER(BTRIM($1))
       AND assigned_to = $2
       AND due_date = $3
     ORDER BY id DESC
     LIMIT 1`,
    [title, assigned_to, due_date]
  );

  return duplicateResult.rows[0] || null;
}

async function insertDailyTask(executor, {
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
  source = "manual",
}) {
  const result = await runDbQuery(
    executor,
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
       source,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
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
      source,
    ]
  );

  return result.rows[0];
}

externalRouter.post("/external-create", requireTaskApiKey, async (req, res) => {
  const validation = validateExternalDailyTaskPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const task = validation.value;

  try {
    const assignedUserCheck = await ensureAssignedUserExists(pool, task.assigned_to);

    if (!assignedUserCheck.ok) {
      return res.status(assignedUserCheck.status).json({ message: assignedUserCheck.message });
    }

    if (!task.force) {
      const duplicateTask = await findExistingTaskDuplicate(pool, task);

      if (duplicateTask) {
        return res.status(409).json({
          message: "Duplicate daily task already exists for the same assignee and due date",
          existingTask: duplicateTask,
        });
      }
    }

    const createdTask = await insertDailyTask(pool, {
      ...task,
      assigned_by: null,
      completed_at: DONE_TASK_STATUSES.includes(task.status) ? new Date().toISOString() : null,
      verified_by: null,
    });

    return res.status(201).json({ ok: true, task: createdTask });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create external daily task", error: error.message });
  }
});

externalRouter.post("/external-bulk-create", requireTaskApiKey, async (req, res) => {
  const items = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const force = Boolean(req.body?.force);

  if (!items.length) {
    return res.status(400).json({ message: "At least one task is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdTasks = [];

    for (let index = 0; index < items.length; index += 1) {
      const validation = validateExternalDailyTaskPayload({
        ...items[index],
        force: force || items[index]?.force,
      });

      if (!validation.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Task ${index + 1}: ${validation.message}` });
      }

      const task = validation.value;
      const assignedUserCheck = await ensureAssignedUserExists(client, task.assigned_to);

      if (!assignedUserCheck.ok) {
        await client.query("ROLLBACK");
        return res.status(assignedUserCheck.status).json({ message: `Task ${index + 1}: ${assignedUserCheck.message}` });
      }

      if (!task.force) {
        const duplicateTask = await findExistingTaskDuplicate(client, task);

        if (duplicateTask) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            message: `Task ${index + 1}: duplicate daily task already exists for the same assignee and due date`,
            existingTask: duplicateTask,
          });
        }
      }

      const createdTask = await insertDailyTask(client, {
        ...task,
        assigned_by: null,
        completed_at: DONE_TASK_STATUSES.includes(task.status) ? new Date().toISOString() : null,
        verified_by: null,
      });

      createdTasks.push(createdTask);
    }

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, tasks: createdTasks });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Unable to bulk create external daily tasks", error: error.message });
  } finally {
    client.release();
  }
});

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
    const createdTask = await insertDailyTask(query, {
      ...task,
      assigned_by: req.user.id,
      completed_at: DONE_TASK_STATUSES.includes(task.status) ? new Date().toISOString() : null,
      verified_by: task.status === "verified" ? req.user.id : null,
      source: "manual",
    });

    return res.status(201).json(createdTask);
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

export { externalRouter as externalDailyTasksRouter };
export default router;
