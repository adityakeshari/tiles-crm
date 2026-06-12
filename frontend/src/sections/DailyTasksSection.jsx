import { memo, useCallback, useEffect, useMemo, useState } from "react";
import WorkspaceTabs from "../components/WorkspaceTabs.jsx";
import { api } from "../api.js";

const TASK_PROGRESS_MAP = {
  pending: 0,
  in_progress: 50,
  hold: 25,
  completed: 100,
  verified: 100,
};

function getTaskDueLabel(task, formatDate) {
  const dateLabel = formatDate(task?.due_date);
  const timeValue = String(task?.due_time || "").slice(0, 5);
  return timeValue ? `${dateLabel} | ${timeValue}` : dateLabel;
}

// Compact "4:00 PM" style time for the staff checklist row — falls back to the due date when no time is set.
function getCompactDueLabel(task, formatDate) {
  const timeValue = String(task?.due_time || "").slice(0, 5);
  if (timeValue) {
    const [hourPart, minutePart] = timeValue.split(":");
    const hour = Number(hourPart);
    if (!Number.isNaN(hour) && minutePart) {
      const period = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${hour12}:${minutePart} ${period}`;
    }
    return timeValue;
  }
  return formatDate(task?.due_date);
}

// Time-of-day buckets for the staff "time-wise schedule checklist" — tasks group under section
// headers (Morning / Afternoon / Evening / Anytime) by their due_time, mirroring the reference UX.
const STAFF_TIME_SECTIONS = [
  { key: "morning", label: "Morning", icon: "🌅", range: "Before 12:00 PM" },
  { key: "afternoon", label: "Afternoon", icon: "☀️", range: "12:00 – 5:00 PM" },
  { key: "evening", label: "Evening", icon: "🌙", range: "After 5:00 PM" },
  { key: "anytime", label: "Anytime", icon: "🗒️", range: "No fixed time" },
];

function getStaffTimeSectionKey(task) {
  const timeValue = String(task?.due_time || "").slice(0, 5);
  if (!timeValue) return "anytime";
  const [hourPart, minutePart] = timeValue.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "anytime";
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes < 720) return "morning";
  if (totalMinutes < 1020) return "afternoon";
  return "evening";
}

function getDueTimeSortValue(task) {
  const timeValue = String(task?.due_time || "").slice(0, 5);
  if (!timeValue) return 24 * 60 + 1; // no fixed time sorts last within its section
  const [hourPart, minutePart] = timeValue.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 24 * 60 + 1;
  return hour * 60 + minute;
}

function groupStaffTasksByTimeSection(tasks) {
  const buckets = new Map(STAFF_TIME_SECTIONS.map((section) => [section.key, []]));
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const key = getStaffTimeSectionKey(task);
    if (buckets.has(key)) {
      buckets.get(key).push(task);
    }
  });
  return STAFF_TIME_SECTIONS
    .map((section) => ({
      ...section,
      // Time-wise to-do list: within each day part, earliest due time first;
      // ties broken by due date then priority order from the server response.
      items: (buckets.get(section.key) || []).slice().sort((a, b) => {
        const dateA = String(a?.due_date || "");
        const dateB = String(b?.due_date || "");
        if (dateA !== dateB) return dateA < dateB ? -1 : 1;
        return getDueTimeSortValue(a) - getDueTimeSortValue(b);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

function countDoneTasks(items) {
  return (Array.isArray(items) ? items : []).filter((task) =>
    ["completed", "verified"].includes(String(task?.status || ""))
  ).length;
}

function getTaskSourceLabel(source) {
  const normalizedSource = String(source || "").trim().toLowerCase();

  if (!normalizedSource || normalizedSource === "manual") {
    return "Manual";
  }

  if (normalizedSource === "chatgpt") {
    return "ChatGPT";
  }

  if (normalizedSource === "claude") {
    return "Claude";
  }

  if (normalizedSource === "automation") {
    return "Auto";
  }

  return "Auto";
}

function getTaskEmptyState(tab, canManageAllTasks, summary) {
  const overdueCount = Number(summary?.overdue_tasks || 0);
  if (tab === "today") {
    return {
      title: "No tasks today",
      message:
        overdueCount > 0
          ? `No tasks scheduled for today, but ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention.`
          : "No tasks scheduled for today.",
    };
  }

  if (tab === "my") {
    return {
      title: canManageAllTasks ? "No tasks in your queue" : "No assigned tasks",
      message: canManageAllTasks
        ? "No personal task is assigned in the current filter."
        : "You have no assigned tasks in the current filter.",
    };
  }

  if (tab === "pending") {
    return {
      title: "All active tasks are done",
      message: "No pending or in-progress tasks are left in this view.",
    };
  }

  if (tab === "completed") {
    return {
      title: "No completed tasks yet",
      message: "Completed work will appear here once staff finish and update tasks.",
    };
  }

  if (tab === "overdue") {
    return {
      title: "No overdue tasks",
      message: "Good job. Nothing is overdue in the current scope.",
    };
  }

  return {
    title: "No tasks found",
    message: "Try changing the current task view or filters.",
  };
}

function getStaffProgressLabel(item) {
  const completedCount = Number(item?.completed_tasks || 0) + Number(item?.verified_tasks || 0);
  const totalCount = Number(item?.total_tasks || 0);
  return `${completedCount}/${totalCount} done`;
}

function getTaskProgressPercent(task) {
  const normalizedStatus = String(task?.status || "").trim().toLowerCase();
  return TASK_PROGRESS_MAP[normalizedStatus] ?? 0;
}

function getProgressSeverity({ assigned, completed, pending, overdue }) {
  const completionPercent = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

  if (assigned > 0 && completionPercent >= 100 && overdue === 0 && pending === 0) {
    return "healthy";
  }

  if (overdue > 0 && completionPercent < 50) {
    return "critical";
  }

  if (pending > 0 || overdue > 0) {
    return "attention";
  }

  return "neutral";
}

function isTaskAssignedToCurrentUser(task, user) {
  return Number(task?.assigned_to || 0) === Number(user?.id || 0);
}

function canSelfActionTask(task, user) {
  return isTaskAssignedToCurrentUser(task, user);
}

function canReviewTask(task, user, canManageAllTasks) {
  return canManageAllTasks && !isTaskAssignedToCurrentUser(task, user);
}

function getTodayInputDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getUserRoles(userLike) {
  if (Array.isArray(userLike?.roles) && userLike.roles.length) {
    return userLike.roles.filter(Boolean);
  }
  if (userLike?.role) {
    return [userLike.role];
  }
  return [];
}

const TEMPLATE_FREQUENCY_LABELS = {
  daily: "Daily",
  weekdays: "Mon–Sat",
  weekly: "Weekly",
};

const TEMPLATE_WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EMPTY_TEMPLATE_FORM = {
  title: "",
  description: "",
  assigned_to: "",
  priority: "medium",
  due_time: "",
  frequency: "daily",
  weekly_day: "1",
};

// Self-contained "Recurring" tab: manages daily_task_templates, the blueprints
// the backend turns into real tasks automatically every morning.
function DailyTaskTemplatesPanel({ users, labelize, EmptyState }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getDailyTaskTemplates();
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load recurring templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function resetForm() {
    setForm(EMPTY_TEMPLATE_FORM);
    setEditingId(null);
    setIsFormOpen(false);
  }

  function startEditing(template) {
    setForm({
      title: template.title || "",
      description: template.description || "",
      assigned_to: String(template.assigned_to || ""),
      priority: template.priority || "medium",
      due_time: template.due_time ? String(template.due_time).slice(0, 5) : "",
      frequency: template.frequency || "daily",
      weekly_day: template.weekly_day === null || typeof template.weekly_day === "undefined"
        ? "1"
        : String(template.weekly_day),
    });
    setEditingId(template.id);
    setIsFormOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusyAction("save-template");
    setError("");
    setNotice("");

    const payload = {
      title: form.title,
      description: form.description,
      assigned_to: form.assigned_to,
      priority: form.priority,
      due_time: form.due_time,
      frequency: form.frequency,
      weekly_day: form.frequency === "weekly" ? Number(form.weekly_day) : null,
    };

    try {
      if (editingId) {
        await api.updateDailyTaskTemplate(editingId, payload);
        setNotice("Template updated.");
      } else {
        await api.createDailyTaskTemplate(payload);
        setNotice("Template created. Tasks will be generated automatically every morning.");
      }
      resetForm();
      await loadTemplates();
    } catch (saveError) {
      setError(saveError.message || "Unable to save template");
    } finally {
      setBusyAction("");
    }
  }

  async function handleToggleActive(template) {
    setBusyAction(`toggle-${template.id}`);
    setError("");

    try {
      await api.updateDailyTaskTemplate(template.id, { is_active: !template.is_active });
      await loadTemplates();
    } catch (toggleError) {
      setError(toggleError.message || "Unable to update template");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete(template) {
    if (!window.confirm(`Delete recurring template "${template.title}"? Already generated tasks stay as they are.`)) {
      return;
    }

    setBusyAction(`delete-${template.id}`);
    setError("");

    try {
      await api.deleteDailyTaskTemplate(template.id);
      if (editingId === template.id) {
        resetForm();
      }
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete template");
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateNow() {
    setBusyAction("generate-now");
    setError("");
    setNotice("");

    try {
      const result = await api.generateDailyTasksNow();
      setNotice(
        `Generated for ${result?.date || "today"}: ${Number(result?.created || 0)} new task(s) created, ${Number(
          result?.skipped || 0
        )} already existed.`
      );
      await loadTemplates();
    } catch (generateError) {
      setError(generateError.message || "Unable to generate tasks");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section className="panel daily-task-templates-panel">
      <div className="section-head daily-task-create-head">
        <div>
          <h2>Recurring task templates</h2>
          <span>
            These templates create real tasks automatically every morning. Pause a template to stop it without deleting.
          </span>
        </div>
        <div className="lead-actions daily-task-create-actions">
          <button
            type="button"
            className="secondary"
            onClick={handleGenerateNow}
            disabled={busyAction === "generate-now"}
            title="Create today's tasks from active templates immediately (duplicates are skipped)"
          >
            {busyAction === "generate-now" ? "Generating..." : "Generate Now"}
          </button>
          {!isFormOpen ? (
            <button type="button" className="daily-task-create-button" onClick={() => setIsFormOpen(true)}>
              + New Template
            </button>
          ) : null}
        </div>
      </div>

      {notice ? <p className="loading-banner">{notice}</p> : null}
      {error ? <p className="field-error-message">{error}</p> : null}

      {isFormOpen ? (
        <form className="daily-task-form compact-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Task title *</label>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. Morning showroom walk"
              required
            />
          </div>
          <div className="form-field">
            <label>Assigned to *</label>
            <select
              value={form.assigned_to}
              onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
              required
            >
              <option value="">Select staff</option>
              {(Array.isArray(users) ? users : []).map((teamMember) => (
                <option key={teamMember.id} value={teamMember.id}>
                  {teamMember.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Priority *</label>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="form-field">
            <label>Repeats *</label>
            <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
              <option value="daily">Daily (every day)</option>
              <option value="weekdays">Mon–Sat (Sunday off)</option>
              <option value="weekly">Weekly (one day)</option>
            </select>
          </div>
          {form.frequency === "weekly" ? (
            <div className="form-field">
              <label>Day of week *</label>
              <select value={form.weekly_day} onChange={(event) => setForm({ ...form, weekly_day: event.target.value })}>
                {TEMPLATE_WEEKDAY_LABELS.map((dayLabel, dayValue) => (
                  <option key={dayLabel} value={dayValue}>
                    {dayLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="form-field">
            <label>Due time</label>
            <input
              type="time"
              value={form.due_time}
              onChange={(event) => setForm({ ...form, due_time: event.target.value })}
            />
          </div>
          <div className="form-field full-span">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What exactly should be done"
            />
          </div>
          <div className="lead-actions full-span">
            <button type="submit" disabled={busyAction === "save-template"}>
              {busyAction === "save-template" ? "Saving..." : editingId ? "Update Template" : "Save Template"}
            </button>
            <button type="button" className="secondary" onClick={resetForm} disabled={busyAction === "save-template"}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="loading-banner">Loading templates...</p> : null}

      {!loading && !templates.length ? (
        <EmptyState
          title="No recurring templates yet"
          message="Create a template (e.g. 'Morning showroom walk — daily 9:00 AM') and the system will assign it automatically every day."
          compact
        />
      ) : null}

      {templates.length ? (
        <ul className="daily-task-checklist daily-task-template-list">
          {templates.map((template) => (
            <li
              key={template.id}
              className={`daily-task-row priority-${template.priority} ${template.is_active ? "" : "is-done"}`}
            >
              <button
                type="button"
                className="daily-task-row-body"
                onClick={() => startEditing(template)}
                aria-label={`Edit template ${template.title}`}
              >
                <p className="daily-task-row-title">{template.title}</p>
                <div className="daily-task-row-meta">
                  <span className="daily-task-row-meta-item daily-task-row-assignee">
                    {template.assigned_to_name || "Unassigned"}
                  </span>
                  <span className="daily-task-row-meta-item">
                    {TEMPLATE_FREQUENCY_LABELS[template.frequency] || labelize(template.frequency)}
                    {template.frequency === "weekly" && template.weekly_day !== null
                      ? ` · ${TEMPLATE_WEEKDAY_LABELS[Number(template.weekly_day)] || ""}`
                      : ""}
                  </span>
                  {template.due_time ? (
                    <span className="daily-task-row-meta-item daily-task-row-due">
                      {String(template.due_time).slice(0, 5)}
                    </span>
                  ) : null}
                  <span className="daily-task-row-meta-item daily-task-row-priority">
                    <span className={`daily-task-row-priority-dot priority-${template.priority}`} aria-hidden="true" />
                    {labelize(template.priority)}
                  </span>
                  {!template.is_active ? (
                    <span className="daily-task-row-meta-item daily-task-row-flag daily-task-row-flag-hold">Paused</span>
                  ) : null}
                  {template.last_generated_date ? (
                    <span className="daily-task-row-meta-item">
                      Last run {String(template.last_generated_date).slice(0, 10)}
                    </span>
                  ) : null}
                </div>
              </button>
              <span className="daily-task-row-actions">
                <button
                  type="button"
                  className="secondary daily-task-row-action"
                  onClick={() => handleToggleActive(template)}
                  disabled={busyAction === `toggle-${template.id}`}
                >
                  {template.is_active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  className="secondary daily-task-row-action danger-soft"
                  onClick={() => handleDelete(template)}
                  disabled={busyAction === `delete-${template.id}`}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DailyTasksSectionImpl({
  user,
  users,
  tasks,
  totalTaskCount,
  summary,
  staffSummary,
  tab,
  setTab,
  filters,
  setFilters,
  form,
  setForm,
  formErrors,
  editingTaskId,
  handleSaveTask,
  handleGenerateOperatorRoutine,
  handleGenerateSalesManagerRoutine,
  startEditingTask,
  resetDailyTaskForm,
  requestDeleteDailyTask,
  requestVerifyDailyTask,
  handleQuickDailyTaskStatusUpdate,
  busyAction,
  loading,
  error,
  canManageAllTasks,
  canVerifyDailyTasks,
  canDeleteDailyTasks,
  EmptyState,
  StatCard,
  ListLoadControls,
  listLimit,
  onLoadMore,
  labelize,
  formatDate,
  formatDateTime,
}) {
  const visibleTabs = useMemo(() => {
    // Count badges on tab labels so each tab is worth visiting (or skipping)
    // without clicking it. Counts come from the always-loaded summary.
    const badge = (count) => (Number(count) > 0 ? ` (${Number(count)})` : "");
    const todayBadge = badge(summary?.today_total_tasks);
    const pendingBadge = badge(summary?.pending_tasks);
    const overdueBadge = badge(summary?.overdue_tasks);
    const completedBadge = badge(summary?.today_completed_tasks);

    const baseTabs = canManageAllTasks
      ? [
          { value: "today", label: `Today${todayBadge}` },
          { value: "my", label: "My Tasks" },
          { value: "pending", label: `Pending${pendingBadge}` },
          { value: "overdue", label: `Overdue${overdueBadge}` },
          { value: "completed", label: `Done Today${completedBadge}` },
        ]
      : [
          { value: "pending", label: `My Pending${pendingBadge}` },
          { value: "today", label: `Today${todayBadge}` },
          { value: "my", label: "My Tasks" },
          { value: "overdue", label: `Overdue${overdueBadge}` },
          { value: "completed", label: `Done Today${completedBadge}` },
        ];

    if (canManageAllTasks) {
      baseTabs.push({ value: "summary", label: "Staff Summary" });
      baseTabs.push({ value: "templates", label: "Recurring" });
    }

    return baseTabs;
  }, [canManageAllTasks, summary]);

  const canUpdateTask = (task) => canSelfActionTask(task, user);
  const canReviewTaskItem = (task) => canReviewTask(task, user, canManageAllTasks);
  const [detailTask, setDetailTask] = useState(null);
  const [isCreateFormExpanded, setIsCreateFormExpanded] = useState(false);
  const [routineAssignedUserId, setRoutineAssignedUserId] = useState("");
  const [salesManagerAssignedUserId, setSalesManagerAssignedUserId] = useState("");
  const [routineDate, setRoutineDate] = useState(getTodayInputDate);
  const activeDetailTask = detailTask
    ? (Array.isArray(tasks) ? tasks.find((item) => item.id === detailTask.id) : null) || detailTask
    : null;
  // V4: the time-wise checklist is now the task layout for every role —
  // managers get the same list with assignee + action affordances per row.
  const staffChecklistSections = useMemo(() => groupStaffTasksByTimeSection(tasks), [tasks]);
  const staffChecklistProgress = useMemo(() => {
    const items = Array.isArray(tasks) ? tasks : [];
    const done = countDoneTasks(items);
    const total = items.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [tasks]);
  // Staff previously only got the search/date toolbar on overdue & completed
  // tabs; now every task tab is searchable (summary tab needs no toolbar).
  const shouldShowManagerToolbar = tab !== "summary";
  const taskMetrics = useMemo(() => {
    const items = Array.isArray(tasks) ? tasks : [];
    const counts = {
      total: Number(summary?.today_total_tasks ?? items.length ?? 0),
      completed: Number(summary?.today_completed_tasks ?? items.filter((task) => ["completed", "verified"].includes(task?.status)).length ?? 0),
      pending: Number(summary?.today_pending_tasks ?? items.filter((task) => task?.status === "pending").length ?? 0),
      // Prefer the today-scoped summary so the Command Center stays stable
      // across tabs instead of reflecting whichever tab is currently open.
      inProgress: Number(summary?.today_in_progress_tasks ?? items.filter((task) => task?.status === "in_progress").length),
      overdue: Number(summary?.overdue_tasks ?? items.filter((task) => task?.is_overdue).length ?? 0),
    };
    const overallPercent = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
    return {
      ...counts,
      overallPercent,
    };
  }, [summary, tasks]);
  const eodMetrics = useMemo(() => {
    const items = Array.isArray(tasks) ? tasks : [];
    // Summary-backed numbers (today/all-active scope) so the EOD panel does not
    // change meaning as the manager switches tabs; current-tab items are only
    // used as a fallback and for the notes snapshot.
    const inProgress = Number(
      summary?.today_in_progress_tasks ?? items.filter((task) => task?.status === "in_progress").length
    );
    const delayed = Number(
      summary?.overdue_tasks != null
        ? Number(summary.overdue_tasks) + Number(summary.today_hold_tasks || 0)
        : items.filter((task) => task?.is_overdue || task?.status === "hold").length
    );
    const carryForward = Number(
      summary?.carry_forward_tasks ?? items.filter((task) => task?.is_overdue).length
    );
    const ownerNotes = items
      .filter((task) => task?.remarks || task?.is_overdue || task?.status === "hold")
      .slice(0, 4)
      .map((task) => {
        const label = task?.remarks ? task.remarks : task?.is_overdue ? "Overdue follow-up" : "On hold";
        return `#${task.id} ${task.title}: ${label}`;
      });

    return {
      completedToday: taskMetrics.completed,
      pending: taskMetrics.pending,
      inProgress,
      delayed,
      carryForward,
      ownerNotes,
    };
  }, [taskMetrics, tasks, summary]);
  const emptyState = getTaskEmptyState(tab, canManageAllTasks, summary);
  const visibleTaskCount = Array.isArray(tasks) ? tasks.length : 0;
  const effectiveTotalTaskCount = Number(totalTaskCount || visibleTaskCount);
  const hasMoreTasks = effectiveTotalTaskCount > visibleTaskCount;

  useEffect(() => {
    if (editingTaskId) {
      setIsCreateFormExpanded(true);
    }
  }, [editingTaskId]);

  useEffect(() => {
    if (!canManageAllTasks) {
      setIsCreateFormExpanded(false);
    }
  }, [canManageAllTasks]);

  const mergedStaffSummary = useMemo(() => {
    const summaryMap = new Map(
      (Array.isArray(staffSummary) ? staffSummary : []).map((item) => [String(item?.assigned_to || ""), item])
    );
    const relevantUsers = Array.isArray(users)
      ? users.filter((teamMember) => {
          const roles = Array.isArray(teamMember?.roles) ? teamMember.roles : [teamMember?.role].filter(Boolean);
          return roles.some((role) =>
            ["admin", "owner", "manager", "operator", "operations", "sales", "accounts", "inventory", "reports", "token"].includes(role)
          );
        })
      : [];

    const merged = relevantUsers.map((teamMember) => {
      const base = summaryMap.get(String(teamMember.id)) || {};
      const assigned = Number(base.total_tasks || 0);
      const completed = Number(base.completed_tasks || 0) + Number(base.verified_tasks || 0);
      const pendingCount = Number(base.pending_tasks || 0);
      const delayed = Number(base.overdue_tasks || 0);
      const scorePercent = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return {
        assigned_to: teamMember.id,
        assigned_to_name: teamMember.name,
        total_tasks: assigned,
        completed_tasks: Number(base.completed_tasks || 0),
        verified_tasks: Number(base.verified_tasks || 0),
        pending_tasks: pendingCount,
        overdue_tasks: delayed,
        urgent_tasks: Number(base.urgent_tasks || 0),
        score_percent: scorePercent,
      };
    }).filter((item) =>
      Number(item.total_tasks || 0) > 0 ||
      Number(item.pending_tasks || 0) > 0 ||
      Number(item.completed_tasks || 0) > 0 ||
      Number(item.verified_tasks || 0) > 0 ||
      Number(item.overdue_tasks || 0) > 0 ||
      Number(item.urgent_tasks || 0) > 0
    );

    return merged.length ? merged : (Array.isArray(staffSummary) ? staffSummary : []);
  }, [staffSummary, users]);

  const routineEligibleUsers = useMemo(() => {
    const team = Array.isArray(users) ? users : [];
    const operatorUsers = team.filter((teamMember) => {
      const roles = getUserRoles(teamMember);
      return roles.includes("operator") || roles.includes("operations");
    });

    if (operatorUsers.length) {
      return operatorUsers;
    }

    return team.filter((teamMember) => {
      const roles = getUserRoles(teamMember);
      return !roles.some((role) => ["admin", "owner", "manager"].includes(role));
    });
  }, [users]);

  const salesManagerEligibleUsers = useMemo(() => {
    const team = Array.isArray(users) ? users : [];
    return team.filter((teamMember) => {
      const roles = getUserRoles(teamMember);
      return roles.includes("manager") || roles.includes("sales");
    });
  }, [users]);

  useEffect(() => {
    if (!canManageAllTasks) {
      setRoutineAssignedUserId("");
      setSalesManagerAssignedUserId("");
      return;
    }

    if (!routineEligibleUsers.length) {
      setRoutineAssignedUserId("");
    } else {
      const exists = routineEligibleUsers.some(
        (teamMember) => String(teamMember.id) === String(routineAssignedUserId || "")
      );

      if (!exists) {
        setRoutineAssignedUserId(String(routineEligibleUsers[0].id));
      }
    }

    if (!salesManagerEligibleUsers.length) {
      setSalesManagerAssignedUserId("");
    } else {
      const exists = salesManagerEligibleUsers.some(
        (teamMember) => String(teamMember.id) === String(salesManagerAssignedUserId || "")
      );

      if (!exists) {
        setSalesManagerAssignedUserId(String(salesManagerEligibleUsers[0].id));
      }
    }
  }, [
    canManageAllTasks,
    routineAssignedUserId,
    routineEligibleUsers,
    salesManagerAssignedUserId,
    salesManagerEligibleUsers,
  ]);

  const progressScopeLabel = useMemo(() => {
    if (tab === "today") return "Today progress";
    if (tab === "my") return "My task progress";
    if (tab === "pending") return "Current view progress";
    if (tab === "overdue") return "Overdue progress";
    if (tab === "completed") return "Completed today progress";
    if (tab === "summary") return "Current view progress";
    return "Current view progress";
  }, [tab]);

  const performanceCards = useMemo(() => {
    const items = Array.isArray(tasks) ? tasks : [];

    if (!canManageAllTasks) {
      const assigned = items.length;
      const completed = items.filter((task) => ["completed", "verified"].includes(String(task?.status || ""))).length;
      const pending = items.filter((task) => !["completed", "verified"].includes(String(task?.status || ""))).length;
      const overdue = items.filter((task) => task?.is_overdue).length;
      const completionPercent = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      return [
        {
          key: `my-progress-${user?.id || "current"}`,
          label: "My Progress",
          assigned,
          completed,
          pending,
          overdue,
          completionPercent,
          severity: getProgressSeverity({ assigned, completed, pending, overdue }),
          isSelected: false,
          isEmpty: assigned === 0,
        },
      ];
    }

    const grouped = new Map();
    items.forEach((task) => {
      const key = String(task?.assigned_to || "");
      if (!key) return;
      const current = grouped.get(key) || {
        key,
        assigned_to: task.assigned_to,
        label: task.assigned_to_name || `User ${task.assigned_to}`,
        assigned: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
      };
      current.assigned += 1;
      if (["completed", "verified"].includes(String(task?.status || ""))) {
        current.completed += 1;
      } else {
        current.pending += 1;
      }
      if (task?.is_overdue) {
        current.overdue += 1;
      }
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((item) => {
        const completionPercent = item.assigned > 0 ? Math.round((item.completed / item.assigned) * 100) : 0;
        return {
          ...item,
          completionPercent,
          severity: getProgressSeverity(item),
          isSelected: String(filters.assigned_to || "all") === String(item.assigned_to || ""),
          isEmpty: item.assigned === 0,
        };
      })
      .sort((left, right) => {
        const severityRank = { critical: 0, attention: 1, healthy: 2, neutral: 3 };
        const leftRank = severityRank[left.severity] ?? 4;
        const rightRank = severityRank[right.severity] ?? 4;
        if (leftRank !== rightRank) return leftRank - rightRank;
        if (right.overdue !== left.overdue) return right.overdue - left.overdue;
        if (right.pending !== left.pending) return right.pending - left.pending;
        return left.label.localeCompare(right.label);
      });
  }, [tasks, canManageAllTasks, user?.id, filters.assigned_to]);

  const urgentOpenCount = Number(summary?.urgent_open_tasks || 0);
  const awaitingVerificationCount = Number(summary?.awaiting_verification_tasks || 0);
  const holdCount = Number(summary?.today_hold_tasks || 0);
  const commandStripItems = [
    { label: "Today Tasks", value: taskMetrics.total, tone: "default" },
    { label: "Completed", value: taskMetrics.completed, tone: "accent" },
    { label: "In Progress", value: taskMetrics.inProgress, tone: "default" },
    { label: "Overdue", value: taskMetrics.overdue, tone: "danger" },
    { label: "Urgent", value: urgentOpenCount, tone: "danger" },
    canVerifyDailyTasks ? { label: "To Verify", value: awaitingVerificationCount, tone: "warning" } : null,
    holdCount > 0 ? { label: "Hold", value: holdCount, tone: "warning" } : null,
    { label: "Carry Forward", value: eodMetrics.carryForward, tone: "warning" },
  ].filter(Boolean);

  // Verdict bar: turns the numbers into a one-line decision for the owner.
  const overdueByStaff = mergedStaffSummary
    .filter((item) => Number(item.overdue_tasks || 0) > 0)
    .sort((a, b) => Number(b.overdue_tasks || 0) - Number(a.overdue_tasks || 0))
    .slice(0, 3)
    .map((item) => `${item.assigned_to_name} ${item.overdue_tasks}`)
    .join(" · ");

  const isStaffFilterActive = (staffId) => String(filters.assigned_to) === String(staffId);

  function toggleStaffFilter(staffId) {
    setFilters({
      ...filters,
      assigned_to: isStaffFilterActive(staffId) ? "all" : String(staffId),
    });
  }

  return (
    <section className={`stack workspace-stack daily-tasks-layout ${canManageAllTasks ? "manager-view" : "staff-view"}`}>
      {canManageAllTasks && taskMetrics.overdue > 0 && tab !== "overdue" ? (
        <button
          type="button"
          className="daily-task-verdict-bar"
          onClick={() => setTab("overdue")}
          aria-label={`${taskMetrics.overdue} overdue tasks need attention. Open overdue list.`}
        >
          <span className="daily-task-verdict-text">
            ⚠ {taskMetrics.overdue} overdue need attention
            {overdueByStaff ? ` — ${overdueByStaff}` : ""}
          </span>
          <span className="daily-task-verdict-action">Review →</span>
        </button>
      ) : null}

      <div className="daily-task-sticky-nav">
        <WorkspaceTabs value={tab} onChange={setTab} tabs={visibleTabs} />
        {canManageAllTasks ? (
          <div className="daily-task-command-strip" role="status" aria-label="Today's task numbers">
            {commandStripItems.map((item) => (
              <span key={item.label} className={`daily-task-strip-item tone-${item.tone}`}>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "templates" ? (
        <DailyTaskTemplatesPanel users={users} labelize={labelize} EmptyState={EmptyState} />
      ) : (
      <>

      {canManageAllTasks && tab !== "summary" && tab !== "today" && mergedStaffSummary.length ? (
        <div className="daily-task-staff-chiprow" role="toolbar" aria-label="Filter by staff">
          {mergedStaffSummary.map((item) => {
            const active = isStaffFilterActive(item.assigned_to);
            const overdueCount = Number(item.overdue_tasks || 0);
            return (
              <button
                key={`staff-chip-${item.assigned_to}`}
                type="button"
                className={`daily-task-staff-chip ${active ? "is-active" : ""}`}
                onClick={() => toggleStaffFilter(item.assigned_to)}
                aria-pressed={active}
              >
                {item.assigned_to_name}
                {overdueCount > 0 ? <span className="daily-task-staff-chip-flag">{overdueCount}!</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {performanceCards.length ? (
        <section className="panel daily-task-staff-board-panel">
          <div className="section-head">
            <h2>{canManageAllTasks ? "Staff Performance Board" : "My Progress"}</h2>
            <span>
              {canManageAllTasks
                ? "Tap a staff card to filter the current task view."
                : progressScopeLabel}
            </span>
          </div>
          <div className="daily-task-staff-board">
            {performanceCards.map((item) => {
              const active = Boolean(item.isSelected);
              const assigned = Number(item.assigned || 0);
              const completed = Number(item.completed || 0);
              const pending = Number(item.pending || 0);
              const overdue = Number(item.overdue || 0);
              const percent = Number(item.completionPercent || 0);
              return (
                <button
                  key={`staff-board-${item.key}`}
                  type="button"
                  className={`daily-task-staff-card severity-${item.severity} ${active ? "is-active" : ""} ${item.isEmpty ? "is-empty" : ""}`}
                  onClick={() => {
                    if (canManageAllTasks && item.assigned_to) {
                      toggleStaffFilter(item.assigned_to);
                    }
                  }}
                  aria-pressed={canManageAllTasks ? active : undefined}
                  title={
                    canManageAllTasks && item.assigned_to
                      ? active
                        ? "Clear staff filter"
                        : `Show only ${item.label}'s tasks`
                      : progressScopeLabel
                  }
                  disabled={!canManageAllTasks}
                >
                  <span className="daily-task-staff-card-head">
                    <strong>{item.label}</strong>
                    <span className="daily-task-staff-card-score">
                      {item.isEmpty ? "No tasks" : `${percent}%`}
                    </span>
                  </span>
                  <span className="daily-task-staff-progress-track" aria-hidden="true">
                    <span className="daily-task-staff-progress-fill" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="daily-task-staff-card-meta">
                    <span>{completed}/{assigned} completed</span>
                    <span>{pending} pending</span>
                    <span className={overdue > 0 ? "tone-danger" : ""}>{overdue} overdue</span>
                  </span>
                  <span className="daily-task-staff-card-scope">{progressScopeLabel}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        className={`panel daily-task-form-panel ${
          !canManageAllTasks && !editingTaskId ? "is-mobile-placeholder" : ""
        }`}
      >
        {canManageAllTasks ? (
          <>
            <div className="section-head daily-task-create-head">
              <div>
                <h2>{editingTaskId ? "Edit task" : "Create task"}</h2>
                <span>
                  {editingTaskId
                    ? "Update the selected task."
                    : isCreateFormExpanded
                      ? "Compact manager form for today's assignments and review follow-up."
                      : "Expand only when you want to assign fresh work."}
                </span>
              </div>
              {canManageAllTasks ? (
                <div className="daily-task-routine-generator">
                  <label className="daily-task-routine-field">
                    <span>Operator routine</span>
                    <select
                      value={routineAssignedUserId}
                      onChange={(event) => setRoutineAssignedUserId(event.target.value)}
                    >
                      <option value="">Select operator</option>
                      {routineEligibleUsers.map((teamMember) => (
                        <option key={`routine-user-${teamMember.id}`} value={teamMember.id}>
                          {teamMember.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary daily-task-routine-button"
                    disabled={!routineAssignedUserId || busyAction === "generate-operator-routine"}
                    onClick={() => handleGenerateOperatorRoutine(routineAssignedUserId, routineDate)}
                  >
                    {busyAction === "generate-operator-routine" ? "Generating..." : "Generate Operator Routine"}
                  </button>
                  <label className="daily-task-routine-field">
                    <span>Sales manager routine</span>
                    <select
                      value={salesManagerAssignedUserId}
                      onChange={(event) => setSalesManagerAssignedUserId(event.target.value)}
                    >
                      <option value="">Select sales manager</option>
                      {salesManagerEligibleUsers.map((teamMember) => (
                        <option key={`routine-sales-${teamMember.id}`} value={teamMember.id}>
                          {teamMember.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary daily-task-routine-button"
                    disabled={!salesManagerAssignedUserId || busyAction === "generate-sales-manager-routine"}
                    onClick={() => handleGenerateSalesManagerRoutine(salesManagerAssignedUserId, routineDate)}
                  >
                    {busyAction === "generate-sales-manager-routine"
                      ? "Generating..."
                      : "Generate Sales Manager Routine"}
                  </button>
                  <label className="daily-task-routine-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={routineDate}
                      onChange={(event) => setRoutineDate(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              {editingTaskId || isCreateFormExpanded ? (
                <div className="lead-actions daily-task-create-actions">
                  <button
                    type="submit"
                    form="daily-task-form"
                    className="daily-task-create-button"
                    disabled={busyAction === "save-daily-task"}
                  >
                    {busyAction === "save-daily-task"
                      ? "Saving..."
                      : editingTaskId
                        ? "Update Task"
                        : "Save Task"}
                  </button>
                  {!editingTaskId ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setIsCreateFormExpanded(false);
                        resetDailyTaskForm();
                      }}
                    >
                      Collapse
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="daily-task-create-button"
                  onClick={() => setIsCreateFormExpanded(true)}
                >
                  + Create Task
                </button>
              )}
            </div>
            {editingTaskId || isCreateFormExpanded ? (
            <form className="daily-task-form compact-form" id="daily-task-form" onSubmit={handleSaveTask}>
              <div className="form-field">
                <label>Task title *</label>
                <input
                  data-field="title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Task title"
                />
                {formErrors.title ? <span className="field-error-message">{formErrors.title}</span> : null}
              </div>
              <div className="form-field">
                <label>Assigned to *</label>
                <select
                  data-field="assigned_to"
                  value={form.assigned_to}
                  onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                >
                  <option value="">Select staff</option>
                  {users.map((teamMember) => (
                    <option key={teamMember.id} value={teamMember.id}>
                      {teamMember.name}
                    </option>
                  ))}
                </select>
                {formErrors.assigned_to ? <span className="field-error-message">{formErrors.assigned_to}</span> : null}
              </div>
              <div className="form-field">
                <label>Priority *</label>
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-field">
                <label>Status *</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="hold">Hold</option>
                  {canVerifyDailyTasks ? <option value="verified">Verified</option> : null}
                </select>
              </div>
              <div className="form-field">
                <label>Due date *</label>
                <input
                  type="date"
                  data-field="due_date"
                  value={form.due_date}
                  onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                />
                {formErrors.due_date ? <span className="field-error-message">{formErrors.due_date}</span> : null}
              </div>
              <div className="form-field">
                <label>Due time</label>
                <input
                  type="time"
                  value={form.due_time}
                  onChange={(event) => setForm({ ...form, due_time: event.target.value })}
                />
              </div>
              <div className="form-field full-span">
                <label>Task description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Task description"
                />
              </div>
              <div className="form-field full-span">
                <label>Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                  placeholder="Optional handover note"
                />
              </div>
              {editingTaskId ? (
                <div className="lead-actions full-span">
                  <button type="button" className="secondary" onClick={resetDailyTaskForm} disabled={busyAction === "save-daily-task"}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </form>
            ) : null}
          </>
        ) : editingTaskId ? (
          <>
            <div className="section-head">
              <h2>Quick task update</h2>
              <span>Update status and add remarks for your assigned task.</span>
            </div>
            <form className="daily-task-form compact-form" onSubmit={handleSaveTask}>
              <div className="form-field full-span">
                <label>Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                  placeholder="Add work remarks"
                />
              </div>
              <div className="form-field">
                <label>Status *</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="hold">Hold</option>
                </select>
              </div>
              <div className="lead-actions full-span">
                <button type="submit" disabled={busyAction === "save-daily-task"}>
                  {busyAction === "save-daily-task" ? "Saving..." : "Save Update"}
                </button>
                <button type="button" className="secondary" onClick={resetDailyTaskForm} disabled={busyAction === "save-daily-task"}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : (
          <EmptyState
            title="Select a task to update"
            message="Tap Add Remark or one of the quick status buttons on your task card."
            compact
          />
        )}
      </section>

      <section className="panel daily-task-board-panel">
        <div className="section-head">
          <h2>{tab === "summary" ? "Staff-wise task summary" : canManageAllTasks ? "Task board" : "Today's Work"}</h2>
          <span>
            {tab === "summary"
              ? `${mergedStaffSummary.length} staff summaries`
              : hasMoreTasks
                ? `Showing ${visibleTaskCount} of ${effectiveTotalTaskCount} tasks`
                : `${visibleTaskCount} tasks in current view`}
          </span>
        </div>

        {shouldShowManagerToolbar ? (
          <div className={`daily-task-toolbar ${canManageAllTasks ? "" : "staff-toolbar"} daily-task-toolbar-sticky`}>
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder={canManageAllTasks ? "Search task title, remarks, assignee..." : "Search my tasks..."}
            />
            {canManageAllTasks ? (
              <select
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
                <option value="hold">Hold</option>
              </select>
            ) : null}
            {canManageAllTasks ? (
              <select
                value={filters.priority}
                onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            ) : null}
            {canManageAllTasks ? (
              <select
                value={filters.assigned_to}
                onChange={(event) => setFilters({ ...filters, assigned_to: event.target.value })}
              >
                <option value="all">All Assignees</option>
                {users.map((teamMember) => (
                  <option key={teamMember.id} value={teamMember.id}>
                    {teamMember.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="date"
              value={filters.due_date}
              onChange={(event) => setFilters({ ...filters, due_date: event.target.value })}
            />
          </div>
        ) : null}

        {loading ? <p className="loading-banner">Refreshing daily tasks...</p> : null}
        {error ? <p className="field-error-message">{error}</p> : null}

        {tab === "summary" ? (
          mergedStaffSummary.length ? (
            <div className="daily-task-summary-grid">
              {mergedStaffSummary.map((item) => (
                <article key={`${item.assigned_to}-${item.assigned_to_name}`} className="detail-card daily-task-summary-card">
                  <div className="section-head">
                    <h3>{item.assigned_to_name}</h3>
                    <span className="status-chip">{getStaffProgressLabel(item)}</span>
                  </div>
                  <div className="chip-row">
                    <span className="legend-chip">Assigned {item.total_tasks}</span>
                    <span className="legend-chip">Completed {Number(item.completed_tasks || 0) + Number(item.verified_tasks || 0)}</span>
                    <span className="legend-chip">Pending {item.pending_tasks}</span>
                    <span className="legend-chip">Delayed {item.overdue_tasks}</span>
                    <span className="legend-chip">Score {Number(item.score_percent || 0)}%</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No staff summary yet"
              message="Once tasks are assigned, staff-wise performance cards will appear here."
              compact
            />
          )
        ) : tasks.length ? (
            <div className="daily-task-schedule">
              {!canManageAllTasks ? (
                <>
                  <div
                    className="daily-task-progress"
                    role="img"
                    aria-label={`${staffChecklistProgress.done} of ${staffChecklistProgress.total} tasks done, ${staffChecklistProgress.percent} percent complete`}
                  >
                    <div className="daily-task-progress-track">
                      <div className="daily-task-progress-fill" style={{ width: `${staffChecklistProgress.percent}%` }} />
                    </div>
                    <span className="daily-task-progress-label">
                      {staffChecklistProgress.done} of {staffChecklistProgress.total} tasks done · {staffChecklistProgress.percent}%
                    </span>
                  </div>
                  <p className="daily-task-checklist-hint">Tap circle to complete task</p>
                </>
              ) : (
                <p className="daily-task-checklist-hint">
                  Time-wise list — tap the circle to complete, tap a task for details and actions.
                </p>
              )}

              {staffChecklistSections.map((section) => {
                const sectionDone = countDoneTasks(section.items);
                const sectionTotal = section.items.length;
                return (
                  <div key={section.key} className="daily-task-time-section">
                    <div className="daily-task-time-section-head">
                      <span className="daily-task-time-section-icon" aria-hidden="true">{section.icon}</span>
                      <span className="daily-task-time-section-title">{section.label}</span>
                      <span className="daily-task-time-section-range">{section.range}</span>
                      <span className={`daily-task-time-section-badge ${sectionDone === sectionTotal ? "is-complete" : ""}`}>
                        {sectionDone}/{sectionTotal}
                      </span>
                    </div>
                    <ul className="daily-task-checklist">
                      {section.items.map((task) => {
                        const isDone = ["completed", "verified"].includes(String(task.status || ""));
                        const isVerified = String(task.status || "") === "verified";
                        const isOwnTask = canUpdateTask(task);
                        const canReviewOnly = canReviewTaskItem(task);
                        return (
                          <li
                            key={task.id}
                            className={`daily-task-row priority-${task.priority} ${isDone ? "is-done" : ""}`}
                          >
                            <button
                              type="button"
                              className={`daily-task-row-check ${isDone ? "is-complete" : ""} ${isVerified ? "is-locked" : ""}`}
                              onClick={() => {
                                if (canUpdateTask(task) && !isVerified) {
                                  handleQuickDailyTaskStatusUpdate(task, "completed");
                                }
                              }}
                              disabled={!canUpdateTask(task) || busyAction === `daily-task-status-${task.id}` || isVerified}
                              aria-label={isVerified ? "Task verified" : isDone ? "Task completed" : "Mark task complete"}
                              title={isVerified ? "Verified" : isDone ? "Completed" : "Tap to mark complete"}
                            >
                              <span className="daily-task-row-check-mark">{isDone ? "✓" : ""}</span>
                            </button>

                            <button
                              type="button"
                              className="daily-task-row-body"
                              onClick={() => setDetailTask(task)}
                              aria-label={`Open details for ${task.title}`}
                            >
                              <p className="daily-task-row-title">{task.title}</p>
                              <div className="daily-task-row-meta">
                                <span className="daily-task-row-meta-item daily-task-row-due">
                                  {getCompactDueLabel(task, formatDate)}
                                </span>
                                {canManageAllTasks ? (
                                  <span className="daily-task-row-meta-item daily-task-row-assignee">
                                    {task.assigned_to_name || "Unassigned"}
                                  </span>
                                ) : null}
                                <span className="daily-task-row-meta-item daily-task-row-priority">
                                  <span className={`daily-task-row-priority-dot priority-${task.priority}`} aria-hidden="true" />
                                  {labelize(task.priority)}
                                </span>
                                {task.is_overdue ? (
                                  <span className="daily-task-row-meta-item daily-task-row-flag">Overdue</span>
                                ) : null}
                                {task.status === "hold" ? (
                                  <span className="daily-task-row-meta-item daily-task-row-flag daily-task-row-flag-hold">
                                    On hold
                                  </span>
                                ) : null}
                                {task.status === "in_progress" ? (
                                  <span className="daily-task-row-meta-item daily-task-row-flag daily-task-row-flag-active">
                                    In progress
                                  </span>
                                ) : null}
                              </div>
                            </button>

                            {canManageAllTasks ? (
                              <span className="daily-task-row-actions">
                                {isOwnTask && task.status === "pending" ? (
                                  <button
                                    type="button"
                                    className="secondary daily-task-row-action"
                                    onClick={() => handleQuickDailyTaskStatusUpdate(task, "in_progress")}
                                    disabled={busyAction === `daily-task-status-${task.id}`}
                                  >
                                    Start
                                  </button>
                                ) : null}
                                {canReviewOnly && !isVerified ? (
                                  <button
                                    type="button"
                                    className="secondary daily-task-row-action"
                                    onClick={() => setDetailTask(task)}
                                  >
                                    Review
                                  </button>
                                ) : null}
                                {canVerifyDailyTasks && task.status === "completed" ? (
                                  <button
                                    type="button"
                                    className="daily-task-row-action daily-task-row-verify"
                                    onClick={() => requestVerifyDailyTask(task)}
                                    disabled={busyAction === `verify-daily-task-${task.id}`}
                                  >
                                    Verify
                                  </button>
                                ) : null}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
        ) : (
          <EmptyState
            title={emptyState.title}
            message={emptyState.message}
            compact
          />
        )}
        {tab !== "summary" && hasMoreTasks ? (
          <ListLoadControls count={visibleTaskCount} limit={listLimit} onLoadMore={onLoadMore} disabled={loading} />
        ) : null}
      </section>

      {canManageAllTasks ? (
        <section className="panel daily-task-eod-panel">
          {/* Collapsed during the working day (3 of its 5 numbers repeat the
              command strip); opens automatically in the evening review window. */}
          <details className="daily-task-eod-details" open={new Date().getHours() >= 17}>
            <summary>
              <span className="daily-task-eod-summary-title">EOD Review</span>
              <span className="daily-task-eod-summary-hint">
                Carry forward {eodMetrics.carryForward} · Delayed {eodMetrics.delayed}
              </span>
            </summary>
          <div className="report-grid daily-task-snapshot-grid">
            <StatCard label="Completed today" value={eodMetrics.completedToday} tone="accent" />
            <StatCard label="Pending" value={eodMetrics.pending} tone="warning" />
            <StatCard label="In Progress" value={eodMetrics.inProgress} />
            <StatCard label="Delayed" value={eodMetrics.delayed} tone="danger" />
            <StatCard label="Carry forward" value={eodMetrics.carryForward} />
          </div>
          <div className="daily-task-eod-notes">
            <label>Owner notes snapshot</label>
            <textarea
              readOnly
              value={
                eodMetrics.ownerNotes.length
                  ? eodMetrics.ownerNotes.join("\n")
                  : "No special carry-forward notes from current tasks."
              }
            />
          </div>
          </details>
        </section>
      ) : null}

      </>
      )}

      {activeDetailTask ? (
        <div
          className="daily-task-detail-overlay"
          onClick={() => setDetailTask(null)}
          role="presentation"
        >
          <div
            className="daily-task-detail-view"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Task details: ${activeDetailTask.title}`}
          >
            <div className="daily-task-detail-handle" aria-hidden="true" />
            <div className="daily-task-detail-head">
              <h3>{activeDetailTask.title}</h3>
              <button
                type="button"
                className="daily-task-detail-close"
                onClick={() => setDetailTask(null)}
                aria-label="Close task details"
              >
                ×
              </button>
            </div>

            <div className="daily-task-detail-body">
            <div className="daily-task-card-meta">
              <span className="legend-chip">Task ID #{activeDetailTask.id}</span>
              <span className="legend-chip">Date {formatDate(activeDetailTask.created_at)}</span>
              <span className="legend-chip">Assigned {activeDetailTask.assigned_to_name || "Unassigned"}</span>
              <span className="legend-chip">Status {labelize(activeDetailTask.status)}</span>
              <span className="legend-chip">Due {getTaskDueLabel(activeDetailTask, formatDate)}</span>
              <span
                className={`legend-chip daily-task-source-chip daily-task-source-${String(activeDetailTask.source || "manual").toLowerCase()}`}
              >
                  {getTaskSourceLabel(activeDetailTask.source)}
                </span>
                {activeDetailTask.verified_by_name ? (
                  <span className="legend-chip">Verified by {activeDetailTask.verified_by_name}</span>
                ) : null}
              </div>

              <p className="muted daily-task-card-timestamps">
                Created {formatDateTime(activeDetailTask.created_at)} | Last updated {formatDateTime(activeDetailTask.updated_at)}
                {activeDetailTask.completed_at ? ` | Completed ${formatDateTime(activeDetailTask.completed_at)}` : ""}
              </p>

              {activeDetailTask.description ? (
                <p>{activeDetailTask.description}</p>
              ) : (
                <p className="muted">No description added yet.</p>
              )}

              <p className="muted daily-task-remarks">
                <strong>Remarks:</strong> {activeDetailTask.remarks || "No remarks yet."}
              </p>

              {canUpdateTask(activeDetailTask) || canManageAllTasks ? (
                <div className="daily-task-detail-actions">
                  {canUpdateTask(activeDetailTask) && activeDetailTask.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleQuickDailyTaskStatusUpdate(activeDetailTask, "in_progress");
                        setDetailTask(null);
                      }}
                      disabled={busyAction === `daily-task-status-${activeDetailTask.id}`}
                    >
                      Start
                    </button>
                  ) : null}
                  {canUpdateTask(activeDetailTask) &&
                  !["completed", "verified"].includes(String(activeDetailTask.status || "")) ? (
                    <button
                      type="button"
                      className="daily-task-inline-complete"
                      onClick={() => {
                        handleQuickDailyTaskStatusUpdate(activeDetailTask, "completed");
                        setDetailTask(null);
                      }}
                      disabled={busyAction === `daily-task-status-${activeDetailTask.id}`}
                    >
                      Complete
                    </button>
                  ) : null}
                  {canUpdateTask(activeDetailTask) &&
                  activeDetailTask.status !== "hold" &&
                  !["completed", "verified"].includes(String(activeDetailTask.status || "")) ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        handleQuickDailyTaskStatusUpdate(activeDetailTask, "hold");
                        setDetailTask(null);
                      }}
                      disabled={busyAction === `daily-task-status-${activeDetailTask.id}`}
                    >
                      Hold
                    </button>
                  ) : null}
                  {canReviewTaskItem(activeDetailTask) ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        startEditingTask(activeDetailTask);
                        setDetailTask(null);
                      }}
                    >
                      Review
                    </button>
                  ) : null}
                  {canVerifyDailyTasks && activeDetailTask.status === "completed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        requestVerifyDailyTask(activeDetailTask);
                        setDetailTask(null);
                      }}
                    >
                      Verify
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      startEditingTask(activeDetailTask);
                      setDetailTask(null);
                    }}
                  >
                    {canReviewTaskItem(activeDetailTask) ? "Edit" : canManageAllTasks ? "Edit" : "Remark"}
                  </button>
                  {canDeleteDailyTasks ? (
                    <button
                      type="button"
                      className="secondary danger-soft"
                      onClick={() => {
                        requestDeleteDailyTask(activeDetailTask);
                        setDetailTask(null);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const DailyTasksSection = memo(DailyTasksSectionImpl);

export default DailyTasksSection;
