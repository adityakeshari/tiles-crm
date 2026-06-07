import { memo, useMemo } from "react";
import WorkspaceTabs from "../components/WorkspaceTabs.jsx";

function getTaskDueLabel(task, formatDate) {
  const dateLabel = formatDate(task?.due_date);
  const timeValue = String(task?.due_time || "").slice(0, 5);
  return timeValue ? `${dateLabel} | ${timeValue}` : dateLabel;
}

function getTaskSourceLabel(source) {
  const normalizedSource = String(source || "").trim().toLowerCase();

  if (normalizedSource === "chatgpt") {
    return "ChatGPT";
  }

  if (normalizedSource === "claude") {
    return "Claude";
  }

  if (normalizedSource === "automation") {
    return "Auto";
  }

  return "";
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
    const baseTabs = [
      { value: "today", label: "Today's Tasks" },
      { value: "my", label: "My Tasks" },
      { value: "pending", label: "Pending Tasks" },
      { value: "completed", label: "Completed Tasks" },
      { value: "overdue", label: "Overdue Tasks" },
    ];

    if (canManageAllTasks) {
      baseTabs.push({ value: "summary", label: "Staff-wise Task Summary" });
    }

    return baseTabs;
  }, [canManageAllTasks]);

  const canUpdateTask = (task) => Number(task?.assigned_to || 0) === Number(user?.id || 0);

  return (
    <section className="stack workspace-stack">
      <WorkspaceTabs value={tab} onChange={setTab} tabs={visibleTabs} />

      <section className="panel">
        <div className="section-head">
          <h2>Daily Tasks</h2>
          <span>Assign, track, and verify daily work without leaving CRM.</span>
        </div>
        <div className="report-grid">
          <StatCard label="Today total tasks" value={summary?.today_total_tasks ?? 0} />
          <StatCard label="Completed" value={summary?.today_completed_tasks ?? 0} tone="accent" />
          <StatCard label="Pending" value={summary?.today_pending_tasks ?? 0} tone="warning" />
          <StatCard label="Overdue" value={summary?.overdue_tasks ?? 0} tone="danger" />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{canManageAllTasks ? (editingTaskId ? "Edit task" : "Create task") : "Task update"}</h2>
          <span>
            {canManageAllTasks
              ? "Manager and admin can create, assign, and review daily work."
              : editingTaskId
                ? "Update status and remarks for your assigned task."
                : "Choose one of your assigned tasks to update status or remarks."}
          </span>
        </div>

        {canManageAllTasks || editingTaskId ? (
          <form className="daily-task-form" onSubmit={handleSaveTask}>
            {canManageAllTasks ? (
              <>
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
              </>
            ) : null}

            <div className={`form-field ${canManageAllTasks ? "full-span" : ""}`}>
              <label>Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                placeholder="Add work remarks"
              />
            </div>

            {!canManageAllTasks ? (
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
            ) : null}

            <div className="lead-actions full-span">
              <button type="submit" disabled={busyAction === "save-daily-task"}>
                {busyAction === "save-daily-task"
                  ? "Saving Task..."
                  : editingTaskId
                    ? "Update Task"
                    : "Save Task"}
              </button>
              {editingTaskId ? (
                <button type="button" className="secondary" onClick={resetDailyTaskForm} disabled={busyAction === "save-daily-task"}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <EmptyState
            title="Select a task to update"
            message="Assigned staff can open a task card below and add progress remarks or change status."
            compact
          />
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{tab === "summary" ? "Staff-wise task summary" : "Task board"}</h2>
          <span>{tab === "summary" ? `${staffSummary.length} staff summaries` : `${tasks.length} tasks in current view`}</span>
        </div>

        <div className="daily-task-toolbar">
          <input
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Search task title, remarks, assignee..."
          />
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

        {loading ? <p className="loading-banner">Refreshing daily tasks...</p> : null}
        {error ? <p className="field-error-message">{error}</p> : null}

        {tab === "summary" ? (
          staffSummary.length ? (
            <div className="daily-task-summary-grid">
              {staffSummary.map((item) => (
                <article key={`${item.assigned_to}-${item.assigned_to_name}`} className="detail-card">
                  <div className="section-head">
                    <h3>{item.assigned_to_name}</h3>
                    <span className="status-chip">{item.total_tasks} tasks</span>
                  </div>
                  <div className="chip-row">
                    <span className="legend-chip">Pending {item.pending_tasks}</span>
                    <span className="legend-chip">Completed {item.completed_tasks}</span>
                    <span className="legend-chip">Verified {item.verified_tasks}</span>
                    <span className="legend-chip">Overdue {item.overdue_tasks}</span>
                    <span className="legend-chip">Urgent {item.urgent_tasks}</span>
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
          <div className="daily-task-card-grid">
            {tasks.map((task) => (
              <article key={task.id} className={`detail-card daily-task-card priority-${task.priority}`}>
                <div className="section-head">
                  <div>
                    <h3>{task.title}</h3>
                    <p className="muted">
                      {task.assigned_to_name || "Unassigned"} | {labelize(task.priority)}
                    </p>
                  </div>
                  <span className={`status-chip status-${task.status}`}>{labelize(task.status)}</span>
                </div>
                <div className="chip-row">
                  <span className="legend-chip">Due {getTaskDueLabel(task, formatDate)}</span>
                  <span className="legend-chip">Assigned by {task.assigned_by_name || "System"}</span>
                  {getTaskSourceLabel(task.source) ? (
                    <span className="legend-chip">Source {getTaskSourceLabel(task.source)}</span>
                  ) : null}
                  {task.verified_by_name ? <span className="legend-chip">Verified by {task.verified_by_name}</span> : null}
                </div>
                {task.description ? <p>{task.description}</p> : <p className="muted">No description added yet.</p>}
                <p className="muted">
                  Created {formatDateTime(task.created_at)} | Updated {formatDateTime(task.updated_at)}
                  {task.completed_at ? ` | Completed ${formatDateTime(task.completed_at)}` : ""}
                </p>
                <p className="muted">Remarks: {task.remarks || "No remarks yet."}</p>
                <div className="lead-actions">
                  {(canManageAllTasks || canUpdateTask(task)) ? (
                    <button type="button" className="secondary" onClick={() => startEditingTask(task)}>
                      {canManageAllTasks ? "Edit" : "Update"}
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
          <EmptyState
            title="No tasks found"
            message="Try changing the current task view or filters."
            compact
          />
        )}
      </section>
    </section>
  );
}

const DailyTasksSection = memo(DailyTasksSectionImpl);

export default DailyTasksSection;
