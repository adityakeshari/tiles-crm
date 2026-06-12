import { memo, useEffect, useMemo, useState } from "react";
import WorkspaceTabs from "../components/WorkspaceTabs.jsx";

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

function groupStaffTasksByTimeSection(tasks) {
  const buckets = new Map(STAFF_TIME_SECTIONS.map((section) => [section.key, []]));
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const key = getStaffTimeSectionKey(task);
    if (buckets.has(key)) {
      buckets.get(key).push(task);
    }
  });
  return STAFF_TIME_SECTIONS
    .map((section) => ({ ...section, items: buckets.get(section.key) || [] }))
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
    const baseTabs = canManageAllTasks
      ? [
          { value: "today", label: "Today's Tasks" },
          { value: "my", label: "My Tasks" },
          { value: "pending", label: "Pending Tasks" },
          { value: "overdue", label: "Overdue" },
          { value: "completed", label: "Completed Today" },
        ]
      : [
          { value: "pending", label: "My Pending Tasks" },
          { value: "today", label: "Today's Tasks" },
          { value: "my", label: "My Tasks" },
          { value: "overdue", label: "Overdue" },
          { value: "completed", label: "Completed Today" },
        ];

    if (canManageAllTasks) {
      baseTabs.push({ value: "summary", label: "Staff-wise Task Summary" });
    }

    return baseTabs;
  }, [canManageAllTasks]);

  const canUpdateTask = (task) =>
    canManageAllTasks || Number(task?.assigned_to || 0) === Number(user?.id || 0);
  const [detailTask, setDetailTask] = useState(null);
  const [isCreateFormExpanded, setIsCreateFormExpanded] = useState(false);
  const activeDetailTask = detailTask
    ? (Array.isArray(tasks) ? tasks.find((item) => item.id === detailTask.id) : null) || detailTask
    : null;
  const staffChecklistSections = useMemo(
    () => (canManageAllTasks ? [] : groupStaffTasksByTimeSection(tasks)),
    [tasks, canManageAllTasks]
  );
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

  return (
    <section className={`stack workspace-stack daily-tasks-layout ${canManageAllTasks ? "manager-view" : "staff-view"}`}>
      <div className="daily-task-sticky-nav">
        <WorkspaceTabs value={tab} onChange={setTab} tabs={visibleTabs} />
      </div>

      {canManageAllTasks ? (
        <section className="panel daily-task-command-panel">
          <div className="section-head">
            <h2>Daily Command Center</h2>
            <span>Assign, track, and review showroom work from one daily board.</span>
          </div>
          <div className="report-grid daily-task-snapshot-grid">
            <StatCard label="Today Tasks" value={taskMetrics.total} />
            <StatCard label="Completed" value={taskMetrics.completed} tone="accent" />
            <StatCard label="In Progress" value={taskMetrics.inProgress} />
            <StatCard label="Pending" value={taskMetrics.pending} tone="warning" />
            <StatCard label="Overdue" value={taskMetrics.overdue} tone="danger" />
            <StatCard label="Overall %" value={`${taskMetrics.overallPercent}%`} />
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
          canManageAllTasks ? (
          <div className="daily-task-card-grid">
            {tasks.map((task) => (
              <article key={task.id} className={`detail-card daily-task-card priority-${task.priority}`}>
                <div className="section-head">
                  <div>
                    <h3>{task.title}</h3>
                    <p className="muted">{task.assigned_to_name || "Unassigned"}</p>
                  </div>
                  <div className="daily-task-card-head-actions">
                    {canUpdateTask(task) ? (
                      <button
                        type="button"
                        className={`daily-task-complete-toggle ${
                          ["completed", "verified"].includes(String(task.status || "")) ? "is-complete" : ""
                        } ${String(task.status || "") === "verified" ? "is-locked" : ""}`}
                        onClick={() => {
                          if (String(task.status || "") !== "verified") {
                            handleQuickDailyTaskStatusUpdate(task, "completed");
                          }
                        }}
                        disabled={
                          busyAction === `daily-task-status-${task.id}` || String(task.status || "") === "verified"
                        }
                        aria-label={
                          String(task.status || "") === "verified"
                            ? "Task verified"
                            : ["completed", "verified"].includes(String(task.status || ""))
                              ? "Task completed"
                              : "Mark task completed"
                        }
                        title={
                          String(task.status || "") === "verified"
                            ? "Verified task"
                            : ["completed", "verified"].includes(String(task.status || ""))
                              ? "Completed"
                              : "Tap to complete"
                        }
                      >
                        <span className="daily-task-complete-icon">
                          {String(task.status || "") === "verified" ? "✓" : ["completed", "verified"].includes(String(task.status || "")) ? "✓" : ""}
                        </span>
                        <span className="daily-task-complete-label">
                          {String(task.status || "") === "verified"
                            ? "Verified"
                            : ["completed", "verified"].includes(String(task.status || ""))
                              ? "Done"
                              : "Complete"}
                        </span>
                      </button>
                    ) : null}
                    <span className={`status-chip status-${task.status}`}>{labelize(task.status)}</span>
                  </div>
                </div>
                <div className="daily-task-card-meta">
                  <span className={`priority-chip priority-${task.priority}`}>{labelize(task.priority)}</span>
                  <span className="legend-chip">Deadline {getTaskDueLabel(task, formatDate)}</span>
                  <span className={`legend-chip ${task.is_overdue ? "legend-urgent" : ""}`}>
                    {task.is_overdue ? "Overdue" : "On Track"}
                  </span>
                </div>
                <div className="daily-task-secondary-desktop">
                  <div className="daily-task-card-meta">
                    <span className="legend-chip">Task ID #{task.id}</span>
                    <span className="legend-chip">Date {formatDate(task.created_at)}</span>
                    <span className="legend-chip">Done {getTaskProgressPercent(task)}%</span>
                    <span className="legend-chip">By {task.assigned_by_name || "System"}</span>
                    <span className={`legend-chip daily-task-source-chip daily-task-source-${String(task.source || "manual").toLowerCase()}`}>
                      {getTaskSourceLabel(task.source)}
                    </span>
                    {task.verified_by_name ? <span className="legend-chip">Verified by {task.verified_by_name}</span> : null}
                  </div>
                  {task.description ? <p>{task.description}</p> : <p className="muted">No description added yet.</p>}
                  <p className="muted daily-task-card-timestamps">
                    Created {formatDateTime(task.created_at)} | Updated {formatDateTime(task.updated_at)}
                    {task.completed_at ? ` | Completed ${formatDateTime(task.completed_at)}` : ""}
                  </p>
                  <p className="muted daily-task-remarks"><strong>Remarks:</strong> {task.remarks || "No remarks yet."}</p>
                </div>
                <details className="daily-task-mobile-details">
                  <summary>Show details</summary>
                  <div className="daily-task-mobile-details-body">
                    <div className="daily-task-card-meta">
                      <span className="legend-chip">Task ID #{task.id}</span>
                      <span className="legend-chip">Date {formatDate(task.created_at)}</span>
                      <span className="legend-chip">Done {getTaskProgressPercent(task)}%</span>
                      <span className="legend-chip">By {task.assigned_by_name || "System"}</span>
                      <span className={`legend-chip daily-task-source-chip daily-task-source-${String(task.source || "manual").toLowerCase()}`}>
                        {getTaskSourceLabel(task.source)}
                      </span>
                      {task.verified_by_name ? <span className="legend-chip">Verified by {task.verified_by_name}</span> : null}
                    </div>
                    {task.description ? <p>{task.description}</p> : <p className="muted">No description added yet.</p>}
                    <p className="muted daily-task-card-timestamps">
                      Created {formatDateTime(task.created_at)} | Updated {formatDateTime(task.updated_at)}
                      {task.completed_at ? ` | Completed ${formatDateTime(task.completed_at)}` : ""}
                    </p>
                    <p className="muted daily-task-remarks"><strong>Remarks:</strong> {task.remarks || "No remarks yet."}</p>
                  </div>
                </details>
                <div className="lead-actions daily-task-actions">
                  {(canManageAllTasks || canUpdateTask(task)) ? (
                    <button type="button" className="secondary" onClick={() => startEditingTask(task)}>
                      {canManageAllTasks ? "Edit" : "Add Remark"}
                    </button>
                  ) : null}
                  {canUpdateTask(task) && task.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => handleQuickDailyTaskStatusUpdate(task, "in_progress")}
                      disabled={busyAction === `daily-task-status-${task.id}`}
                    >
                      Start
                    </button>
                  ) : null}
                  {canUpdateTask(task) && !["completed", "verified"].includes(task.status) ? (
                    <button
                      type="button"
                      className="daily-task-inline-complete"
                      onClick={() => handleQuickDailyTaskStatusUpdate(task, "completed")}
                      disabled={busyAction === `daily-task-status-${task.id}`}
                    >
                      Complete
                    </button>
                  ) : null}
                  {canUpdateTask(task) && task.status !== "hold" && !["completed", "verified"].includes(task.status) ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleQuickDailyTaskStatusUpdate(task, "hold")}
                      disabled={busyAction === `daily-task-status-${task.id}`}
                    >
                      Hold
                    </button>
                  ) : null}
                  {canVerifyDailyTasks && task.status === "completed" ? (
                    <button type="button" onClick={() => requestVerifyDailyTask(task)}>
                      Verify
                    </button>
                  ) : null}
                  {canDeleteDailyTasks ? (
                    <button type="button" className="secondary danger-soft" onClick={() => requestDeleteDailyTask(task)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
              ))}
            </div>
          ) : (
            <div className="daily-task-schedule">
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
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
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
          <div className="section-head">
            <h2>EOD Review</h2>
            <span>End-of-day carry forward snapshot using current daily task data.</span>
          </div>
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
        </section>
      ) : null}

      {!canManageAllTasks && activeDetailTask ? (
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
                Created {formatDateTime(activeDetailTask.created_at)} | Updated {formatDateTime(activeDetailTask.updated_at)}
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

              {canUpdateTask(activeDetailTask) ? (
                <div className="daily-task-detail-actions">
                  {activeDetailTask.status !== "hold" &&
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
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      startEditingTask(activeDetailTask);
                      setDetailTask(null);
                    }}
                  >
                    Remark
                  </button>
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
