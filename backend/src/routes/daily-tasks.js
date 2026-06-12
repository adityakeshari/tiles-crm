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
const TEST_TASK_KEYWORDS = ["test", "trial", "demo", "sample", "dummy", "smoke"];
const TEST_TASK_SOURCE_HINTS = ["chatgpt", "claude", "test", "external"];
const OPERATOR_ROUTINE_TEMPLATE_KEY = "operator_routine_v2";
const SALES_MANAGER_ROUTINE_TEMPLATE_KEY = "sales_manager_routine_v1";
const ROUTINE_TIMEZONE = "Asia/Kolkata";
const OPERATOR_ROUTINE_BLOCKS = [
  {
    due_time: "11:00",
    priority: "medium",
    block: "Opening",
    tasks: [
      "CRM Login",
      "WhatsApp Web Open",
      "Internet/Printer Check",
      "Yesterday Pending Review",
      "Today Due Payments Review",
      "Showroom Opening Checklist",
    ],
  },
  {
    due_time: "12:00",
    priority: "urgent",
    block: "Collection Priority",
    tasks: [
      "Due Payment List Generate",
      "Collection Follow-up Calls",
      "WhatsApp Reminders",
      "Outstanding Customer Update",
      "Collection Status Update",
      "Critical Dues Report",
    ],
  },
  {
    due_time: "13:00",
    priority: "medium",
    block: "Lead & Customer Updates",
    tasks: [
      "New Lead Entry",
      "Lead Status Update",
      "Customer Records Verification",
    ],
  },
  {
    due_time: "14:00",
    priority: "medium",
    block: "Quotations",
    tasks: [
      "Pending Quotations",
      "PDF Sharing",
      "Follow-up Date Update",
    ],
  },
  {
    due_time: "15:00",
    priority: "medium",
    block: "Inventory & Product Updates",
    tasks: [
      "Stock Entry",
      "Product Updates",
      "Low Stock Review",
    ],
  },
  {
    due_time: "16:00",
    priority: "medium",
    block: "Mason / Token / Project Updates",
    tasks: [
      "Mason Registration Updates",
      "Token Updates",
      "Project Updates",
    ],
  },
  {
    due_time: "17:00",
    priority: "medium",
    block: "Accounts Support",
    tasks: [
      "Expense Entry",
      "Cash Entry",
      "Online Payment Entry",
    ],
  },
  {
    due_time: "18:30",
    priority: "medium",
    block: "Daily Verification",
    tasks: [
      "Pending Work Review",
      "Missing Entries Check",
      "Follow-up Verification",
    ],
  },
  {
    due_time: "19:30",
    priority: "high",
    block: "Closing",
    tasks: [
      "Daily Report to Owner",
      "Tomorrow Collection List",
      "Showroom Closing Checklist",
    ],
  },
];
const SALES_MANAGER_ROUTINE_BLOCKS = [
  {
    due_time: "10:00",
    priority: "high",
    block: "Command Review",
    tasks: [
      "Team Attendance Check",
      "Yesterday Pending Review",
      "Overdue Tasks Review",
      "Collection Dashboard Review",
      "Today's Priorities",
    ],
  },
  {
    due_time: "10:30",
    priority: "urgent",
    block: "Collection Recovery",
    tasks: [
      "Due Payment Calls",
      "Dealer Recovery Follow-up",
      "Contractor Recovery Follow-up",
      "Collection Commitments Update",
    ],
  },
  {
    due_time: "12:00",
    priority: "high",
    block: "Sales Follow-up",
    tasks: [
      "Hot Leads",
      "Architect Follow-up",
      "Dealer Follow-up",
      "Site Enquiries",
      "Quotation Follow-up",
    ],
  },
  {
    due_time: "13:30",
    priority: "medium",
    block: "Mason Development",
    tasks: [
      "Mason Calls",
      "New Mason Registration",
      "Referral Generation",
      "Relationship Follow-up",
    ],
  },
  {
    due_time: "15:00",
    priority: "high",
    block: "Team Review",
    tasks: [
      "Poonam Task Review",
      "Pending Task Review",
      "Escalations",
      "Verification Queue",
    ],
  },
  {
    due_time: "16:00",
    priority: "medium",
    block: "Showroom Inspection",
    tasks: [
      "Cleanliness Verified",
      "Display Verified",
      "Branding Verified",
      "Issues Reported",
    ],
  },
  {
    due_time: "16:15",
    priority: "high",
    block: "Sales Conversion",
    tasks: [
      "Negotiation Calls",
      "Quotation Discussions",
      "Project Discussions",
      "Closing Opportunities",
    ],
  },
  {
    due_time: "18:00",
    priority: "high",
    block: "Pipeline Review",
    tasks: [
      "Leads Updated",
      "Collections Updated",
      "Mason Activity Updated",
      "Team Tasks Reviewed",
    ],
  },
  {
    due_time: "19:00",
    priority: "high",
    block: "EOD Reporting",
    tasks: [
      "Collections Summary",
      "Sales Opportunities",
      "Mason Activity",
      "Team Performance",
      "Tomorrow Commitments",
    ],
  },
];
const ROUTINE_CONFIGS = {
  operator: {
    key: OPERATOR_ROUTINE_TEMPLATE_KEY,
    label: "Operator routine",
    blocks: OPERATOR_ROUTINE_BLOCKS,
  },
  sales_manager: {
    key: SALES_MANAGER_ROUTINE_TEMPLATE_KEY,
    label: "Sales manager routine",
    blocks: SALES_MANAGER_ROUTINE_BLOCKS,
  },
};
const OVERDUE_SQL_CONDITION = `(
  (
    t.due_date < CURRENT_DATE
    OR (
      t.due_date = CURRENT_DATE
      AND t.due_time IS NOT NULL
      AND t.due_time::time < CURRENT_TIME
    )
  )
  AND t.status NOT IN ('completed', 'verified')
)`;

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

function canCleanupTasks(user) {
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

function getBusinessTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROUTINE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getRoutineMarker(templateKey) {
  return `[${templateKey}]`;
}

function buildRoutineTaskRemarks(templateKey, block, generatedFor) {
  return `${getRoutineMarker(templateKey)} ${block} for ${generatedFor}`;
}

function buildRoutineItems({ routineConfig, assigned_to, assigned_by, due_date }) {
  return routineConfig.blocks.flatMap((block) =>
    block.tasks.map((title) => ({
      title,
      description: `${block.block} | ${routineConfig.label} for ${due_date}`,
      assigned_to,
      assigned_by,
      priority: block.priority,
      due_date,
      due_time: block.due_time,
      status: "pending",
      remarks: buildRoutineTaskRemarks(routineConfig.key, block.block, due_date),
      completed_at: null,
      verified_by: null,
      source: "automation",
    }))
  );
}

function buildTestTaskWhereClause(alias = "t", params = []) {
  const loweredFields = ["title", "description", "remarks"].map(
    (field) => `LOWER(COALESCE(${alias}.${field}, ''))`
  );
  const keywordConditions = TEST_TASK_KEYWORDS.flatMap((keyword) => {
    params.push(`%${keyword}%`);
    const paramRef = `$${params.length}`;
    return loweredFields.map((field) => `${field} LIKE ${paramRef}`);
  });

  params.push(TEST_TASK_SOURCE_HINTS);
  const sourceParamRef = `$${params.length}`;
  params.push("%api%");
  const apiParamRef = `$${params.length}`;
  params.push("%external%");
  const externalParamRef = `$${params.length}`;

  const externalSourceCondition = `(
    LOWER(COALESCE(${alias}.source, '')) = ANY(${sourceParamRef})
    AND (
      ${loweredFields.map((field) => `${field} LIKE ${apiParamRef}`).join(" OR ")}
      OR ${loweredFields.map((field) => `${field} LIKE ${externalParamRef}`).join(" OR ")}
    )
  )`;

  return `(${[...keywordConditions, externalSourceCondition].join(" OR ")})`;
}

async function getTestTaskAudit(executor) {
  const params = [];
  const where = buildTestTaskWhereClause("t", params);
  const result = await runDbQuery(
    executor,
    `WITH candidates AS (
       SELECT id, title, source, assigned_to, due_date, status, created_at
       FROM daily_tasks t
       WHERE ${where}
     ),
     sample_rows AS (
       SELECT *
       FROM candidates
       ORDER BY created_at DESC
       LIMIT 50
     )
     SELECT
       (SELECT COUNT(*)::int FROM candidates) AS candidate_count,
       COALESCE(
         (
           SELECT JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', sample_rows.id,
               'title', sample_rows.title,
               'source', sample_rows.source,
               'assigned_to', sample_rows.assigned_to,
               'due_date', sample_rows.due_date,
               'status', sample_rows.status,
               'created_at', sample_rows.created_at
             )
             ORDER BY sample_rows.created_at DESC
           )
           FROM sample_rows
         ),
         '[]'::json
       ) AS samples`,
    params
  );

  return result.rows[0] || { candidate_count: 0, samples: [] };
}

async function generateRoutineForUser({ routineConfig, assigned_to, assigned_by, due_date }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignedUserCheck = await ensureAssignedUserExists(client, assigned_to);
    if (!assignedUserCheck.ok) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        status: assignedUserCheck.status,
        body: { message: assignedUserCheck.message },
      };
    }

    const existingRoutineResult = await runDbQuery(
      client,
      `SELECT COUNT(*)::int AS existing_count
       FROM daily_tasks
       WHERE assigned_to = $1
         AND due_date = $2
         AND (
           remarks ILIKE $3
           OR (
             source = 'automation'
             AND title = ANY($4)
           )
         )`,
      [
        assigned_to,
        due_date,
        `%${getRoutineMarker(routineConfig.key)}%`,
        routineConfig.blocks.flatMap((block) => block.tasks),
      ]
    );

    const existingCount = Number(existingRoutineResult.rows?.[0]?.existing_count || 0);
    if (existingCount > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        body: {
          message: `${routineConfig.label} already exists for this user and date`,
          existingCount,
        },
      };
    }

    const routineItems = buildRoutineItems({
      routineConfig,
      assigned_to,
      assigned_by,
      due_date,
    });

    const createdTasks = [];
    for (const item of routineItems) {
      const createdTask = await insertDailyTask(client, item);
      createdTasks.push(createdTask);
    }

    await client.query("COMMIT");
    return {
      ok: true,
      status: 201,
      body: {
        ok: true,
        template: routineConfig.key,
        generatedFor: due_date,
        assignedTo: assigned_to,
        createdCount: createdTasks.length,
        tasks: createdTasks,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[daily-tasks] routine generation failed (${routineConfig.key}):`, error);
    return {
      ok: false,
      status: 500,
      body: { message: `Unable to generate ${routineConfig.label}`, error: error.message },
    };
  } finally {
    client.release();
  }
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
    // The tab is labelled "Completed Today" — without the date condition it
    // listed every completed task ever, which buried today's review.
    params.push(DONE_TASK_STATUSES);
    conditions.push(`t.status = ANY($${params.length})`);
    conditions.push(`COALESCE(t.completed_at, t.updated_at)::date = CURRENT_DATE`);
  } else if (view === "overdue") {
    conditions.push(OVERDUE_SQL_CONDITION);
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
       COUNT(*) FILTER (
         WHERE status IN ('completed', 'verified')
           AND COALESCE(completed_at, updated_at)::date = CURRENT_DATE
       )::int AS today_completed_tasks,
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status NOT IN ('completed', 'verified'))::int AS today_pending_tasks,
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status = 'in_progress')::int AS today_in_progress_tasks,
       COUNT(*) FILTER (WHERE due_date = CURRENT_DATE AND status = 'hold')::int AS today_hold_tasks,
       COUNT(*) FILTER (WHERE ${OVERDUE_SQL_CONDITION})::int AS overdue_tasks,
       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'verified'))::int AS carry_forward_tasks,
       COUNT(*) FILTER (WHERE status NOT IN ('completed', 'verified'))::int AS pending_tasks,
       COUNT(*) FILTER (WHERE status IN ('completed', 'verified'))::int AS completed_tasks,
       COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'verified'))::int AS urgent_open_tasks,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS awaiting_verification_tasks,
       COUNT(*)::int AS total_tasks
     FROM scoped_tasks t`,
    params
  );

  return result.rows[0] || null;
}

router.get("/summary", async (req, res) => {
  try {
    const summary = await getDailyTaskSummary(req.user);
    return res.json(summary || {});
  } catch (error) {
    // Logged so pm2 captures the real failure; previously the error existed
    // only in the HTTP response body and the server error log stayed empty.
    console.error("[daily-tasks] GET /summary failed:", error);
    return res.status(500).json({ message: "Unable to fetch daily task summary", error: error.message });
  }
});

router.get("/admin/test-audit", async (req, res) => {
  if (!canCleanupTasks(req.user)) {
    return res.status(403).json({ message: "Only admin or owner can audit test daily tasks" });
  }

  try {
    const audit = await getTestTaskAudit(query);
    return res.json({
      candidateCount: Number(audit.candidate_count || 0),
      cleanupCriteria: [
        "title/description/remarks contain test keywords: test, trial, demo, sample, dummy, smoke",
        "external/API trial tasks from ChatGPT/Claude/external sources with API/external hints",
      ],
      samples: Array.isArray(audit.samples) ? audit.samples : [],
    });
  } catch (error) {
    console.error("[daily-tasks] GET /admin/test-audit failed:", error);
    return res.status(500).json({ message: "Unable to audit test daily tasks", error: error.message });
  }
});

router.post("/admin/cleanup-test-tasks", async (req, res) => {
  if (!canCleanupTasks(req.user)) {
    return res.status(403).json({ message: "Only admin or owner can clean test daily tasks" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const beforeAudit = await getTestTaskAudit(client);
    const candidateCount = Number(beforeAudit.candidate_count || 0);

    if (!candidateCount) {
      await client.query("COMMIT");
      return res.json({
        deletedCount: 0,
        cleanupCriteria: [
          "title/description/remarks contain test keywords: test, trial, demo, sample, dummy, smoke",
          "external/API trial tasks from ChatGPT/Claude/external sources with API/external hints",
        ],
        deletedTaskIds: [],
      });
    }

    const deleteParams = [];
    const where = buildTestTaskWhereClause("t", deleteParams);
    const deleteResult = await runDbQuery(
      client,
      `DELETE FROM daily_tasks t
       WHERE ${where}
       RETURNING id`,
      deleteParams
    );

    await client.query("COMMIT");
    return res.json({
      deletedCount: deleteResult.rowCount || 0,
      cleanupCriteria: [
        "title/description/remarks contain test keywords: test, trial, demo, sample, dummy, smoke",
        "external/API trial tasks from ChatGPT/Claude/external sources with API/external hints",
      ],
      deletedTaskIds: deleteResult.rows.map((row) => row.id),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[daily-tasks] POST /admin/cleanup-test-tasks failed:", error);
    return res.status(500).json({ message: "Unable to clean test daily tasks", error: error.message });
  } finally {
    client.release();
  }
});

router.post("/generate-operator-routine", async (req, res) => {
  if (!canCreateTasks(req.user)) {
    return res.status(403).json({ message: "You do not have access to generate operator routine tasks" });
  }

  const assigned_to = parsePositiveInteger(req.body?.assigned_to);
  const due_date = typeof req.body?.due_date === "string" && req.body.due_date.trim()
    ? req.body.due_date.trim().slice(0, 10)
    : getBusinessTodayDate();

  if (!assigned_to) {
    return res.status(400).json({ message: "Operator user is required" });
  }

  if (Number.isNaN(new Date(due_date).getTime())) {
    return res.status(400).json({ message: "Routine date is invalid" });
  }

  const result = await generateRoutineForUser({
    routineConfig: ROUTINE_CONFIGS.operator,
    assigned_to,
    assigned_by: req.user.id,
    due_date,
  });

  return res.status(result.status).json(result.body);
});

router.post("/generate-sales-manager-routine", async (req, res) => {
  if (!canCreateTasks(req.user)) {
    return res.status(403).json({ message: "You do not have access to generate sales manager routine tasks" });
  }

  const assigned_to = parsePositiveInteger(req.body?.assigned_to);
  const due_date = typeof req.body?.due_date === "string" && req.body.due_date.trim()
    ? req.body.due_date.trim().slice(0, 10)
    : getBusinessTodayDate();

  if (!assigned_to) {
    return res.status(400).json({ message: "Sales manager user is required" });
  }

  if (Number.isNaN(new Date(due_date).getTime())) {
    return res.status(400).json({ message: "Routine date is invalid" });
  }

  const result = await generateRoutineForUser({
    routineConfig: ROUTINE_CONFIGS.sales_manager,
    assigned_to,
    assigned_by: req.user.id,
    due_date,
  });

  return res.status(result.status).json(result.body);
});

router.get("/", async (req, res) => {
  const limit = parseListLimit(req.query.limit);

  try {
    const taskParams = [];
    const conditions = buildTaskFilters(req, taskParams, req.user);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countParams = [...taskParams];
    taskParams.push(limit);

    const tasksPromise = query(
      `SELECT
         t.*,
         assignee.name AS assigned_to_name,
         assigner.name AS assigned_by_name,
         verifier.name AS verified_by_name,
         ${OVERDUE_SQL_CONDITION} AS is_overdue
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

    const totalCountPromise = query(
      `SELECT COUNT(*)::int AS total_count
       FROM daily_tasks t
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       ${where}`,
      countParams
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
             COUNT(*) FILTER (WHERE ${OVERDUE_SQL_CONDITION})::int AS overdue_tasks,
             COUNT(*) FILTER (WHERE t.priority = 'urgent')::int AS urgent_tasks
           FROM daily_tasks t
           LEFT JOIN users u ON u.id = t.assigned_to
           GROUP BY COALESCE(t.assigned_to, 0), COALESCE(u.name, 'Unassigned')
           ORDER BY overdue_tasks DESC, pending_tasks DESC, assigned_to_name ASC`
        )
      : Promise.resolve({ rows: [] });

    const [tasksResult, totalCountResult, summary, staffSummaryResult] = await Promise.all([
      tasksPromise,
      totalCountPromise,
      summaryPromise,
      staffSummaryPromise,
    ]);

    return res.json({
      tasks: tasksResult.rows,
      totalCount: totalCountResult.rows?.[0]?.total_count || 0,
      summary: summary || {},
      staffSummary: staffSummaryResult.rows || [],
    });
  } catch (error) {
    console.error("[daily-tasks] GET / failed:", error);
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

    const payloadToValidate = {
      ...existingTask,
      ...req.body,
      title: req.body.title ?? existingTask.title,
      description: req.body.description ?? existingTask.description,
      assigned_to: req.body.assigned_to ?? existingTask.assigned_to,
      priority: req.body.priority ?? existingTask.priority,
      due_date:
        req.body.due_date ??
        (existingTask.due_date ? String(existingTask.due_date).slice(0, 10) : ""),
      due_time:
        req.body.due_time ??
        (existingTask.due_time ? String(existingTask.due_time).slice(0, 5) : ""),
      status: req.body.status ?? existingTask.status,
      remarks: req.body.remarks ?? existingTask.remarks,
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
