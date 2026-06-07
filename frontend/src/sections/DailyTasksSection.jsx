import { memo, useMemo } from "react";
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

function getTaskEmptyState(tab, canManageAllTasks) {
  if (tab === "today") {
    return {
      title: "No tasks today",
      message: "Today's task board is clear right now.",
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

  const canUpdateTask = (task) => Number(task?.assigned_to || 0) === Number(user?.id || 0);
  const emptyState = getTaskEmptyState(tab, canManageAllTasks);
  const shouldShowManagerToolbar = canManageAllTasks || tab === "overdue" || tab === "completed";
  const taskMetrics = useMemo(() => {
    const items = Array.isArray(tasks) ? tasks : [];
    const counts = {
      total: Number(summary?.today_total_tasks ?? items.length ?? 0),
      completed: Number(summary?.today_completed_tasks ?? items.filter((task) => ["completed", "verified"].includes(task?.status)).length ?? 0),
      pending: Number(summary?.today_pending_tasks ?? items.filter((task) => task?.status === "pending").length ?? 0),
      inProgress: items.filter((task) => task?.status === "in_progress").length,
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
    const inProgress = items.filter((task) => task?.status === "in_progress").length;
    const delayed = items.filter((task) => task?.is_overdue || task?.status === "hold").length;
    const carryForward = items.filter((task) => ["pending", "in_progress", "hold"].includes(String(task?.status || ""))).length;
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
  }, [taskMetrics, tasks]);
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
      <WorkspaceTabs value={tab} onChange={setTab} tabs={visibleTabs} />

      <section className="panel daily-task-command-panel">
        <div className="section-head">
          <h2>Daily Command Center</h2>
          <span>
            {canManageAllTasks
              ? "Assign, track, and review showroom work from one daily board."
              : "See your assigned work first and update progress quickly."}
          </span>
        </div>
        <div className="report-grid daily-task-snapshot-grid">
          <StatCard label="Total Tasks" value={taskMetrics.total} />
          <StatCard label="Completed" value={taskMetrics.completed} tone="accent" />
          <StatCard label="In Progress" value={taskMetrics.inProgress} />
          <StatCard label="Pending" value={taskMetrics.pending} tone="warning" />
          <StatCard label="Overdue" value={taskMetrics.overdue} tone="danger" />
          <StatCard label="Overall %" value={`${taskMetrics.overallPercent}%`} />
        </div>
      </section>

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
                <span>Compact manager form for today's assignments and review follow-up.</span>
              </div>
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
                    : "Create Task"}
              </button>
            </div>
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
          <h2>{tab === "summary" ? "Staff-wise task summary" : canManageAllTasks ? "Task board" : "My task board"}</h2>
          <span>{tab === "summary" ? `${staffSummary.length} staff summaries` : `${tasks.length} tasks in current view`}</span>
        </div>

        {shouldShowManagerToolbar ? (
          <div className={`daily-task-toolbar ${canManageAllTasks ? "" : "staff-toolbar"}`}>
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
                  <p className="daily-task-summary-progress">
                    {item.assigned_to_name}: {getStaffProgressLabel(item)}
                  </p>
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
                    <button type="button" className="danger" onClick={() => requestDeleteDailyTask(task)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
              ))}
            </div>
          ) : (
            <ul className="daily-task-checklist">
              {tasks.map((task) => {
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

                    <div className="daily-task-row-body">
                      <p className="daily-task-row-title">{task.title}</p>
                      <div className="daily-task-row-meta">
                        <span className="daily-task-row-due">{getTaskDueLabel(task, formatDate)}</span>
                        <span
                          className={`daily-task-row-priority-dot priority-${task.priority}`}
                          role="img"
                          aria-label={`${labelize(task.priority)} priority`}
                          title={`${labelize(task.priority)} priority`}
                        />
                        {task.is_overdue ? <span className="daily-task-row-flag">Overdue</span> : null}
                        {task.status === "hold" ? (
                          <span className="daily-task-row-flag daily-task-row-flag-hold">On hold</span>
                        ) : null}
                      </div>

                      {canUpdateTask(task) ? (
                        <div className="daily-task-row-actions">
                          {task.status !== "hold" && !isDone ? (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleQuickDailyTaskStatusUpdate(task, "hold")}
                              disabled={busyAction === `daily-task-status-${task.id}`}
                            >
                              Hold
                            </button>
                          ) : null}
                          <button type="button" className="secondary" onClick={() => startEditingTask(task)}>
                            Remark
                          </button>
                        </div>
                      ) : null}

                      <details className="daily-task-row-details">
                        <summary>Details</summary>
                        <div className="daily-task-row-details-body">
                          <div className="daily-task-card-meta">
                            <span className="legend-chip">Task ID #{task.id}</span>
                            <span className="legend-chip">Date {formatDate(task.created_at)}</span>
                            <span
                              className={`legend-chip daily-task-source-chip daily-task-source-${String(task.source || "manual").toLowerCase()}`}
                            >
                              {getTaskSourceLabel(task.source)}
                            </span>
                            {task.verified_by_name ? (
                              <span className="legend-chip">Verified by {task.verified_by_name}</span>
                            ) : null}
                          </div>
                          <p className="muted daily-task-card-timestamps">
                            Created {formatDateTime(task.created_at)} | Updated {formatDateTime(task.updated_at)}
                            {task.completed_at ? ` | Completed ${formatDateTime(task.completed_at)}` : ""}
                          </p>
                          {task.description ? (
                            <p>{task.description}</p>
                          ) : (
                            <p className="muted">No description added yet.</p>
                          )}
                          <p className="muted daily-task-remarks">
                            <strong>Remarks:</strong> {task.remarks || "No remarks yet."}
                          </p>
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
          ) : (
            <EmptyState
              title={emptyState.title}
              message={emptyState.message}
              compact
            />
          )}
      </section>

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
    </section>
  );
}

const DailyTasksSection = memo(DailyTasksSectionImpl);

export default DailyTasksSection;
