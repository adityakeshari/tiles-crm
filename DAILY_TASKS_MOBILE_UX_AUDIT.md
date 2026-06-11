# Daily Tasks — Mobile UX Audit

Read-only audit of `DailyTasksSection.jsx` + its styles in `styles.css`. No code changed.

Component renders, in order: tab nav (`WorkspaceTabs`) → "Daily Command Center" snapshot panel (6 stat cards) → Create/Edit task form panel (managers) or quick-update panel (staff) → toolbar + task/staff-summary card grid → "EOD Review" panel (5 stat cards + read-only notes textarea). All five panels stack in one continuous scroll on mobile — there is no sub-navigation between them.

---

## 1. Visual hierarchy
Everything sits at the same visual weight: five `.panel` blocks of equal size, back to back, each with its own `<h2>` + `<span>` sub-line. On a phone the user must scroll past a 6-card snapshot grid, then a full create-task form (managers) or empty-state placeholder (staff), before reaching the actual task list — which is the thing they came for. Nothing signals "this is the most important block." The EOD Review, an end-of-shift artifact, sits at the same level and size as the live task board, competing for attention all day.

## 2. Spacing and card density
`.workspace-stack` gives panels `gap: 0.85rem` and `.daily-task-card` uses `padding: 0.85rem`, which is reasonable. But each task card alone renders up to 9 metadata chips (`.daily-task-card-meta`: ID, date, priority, deadline, % done, overdue yes/no, assigned-by, source, verified-by) plus title, assignee line, status chip, complete-toggle, description/placeholder, a timestamps line, a remarks line, and an action-button row. On a 360–412px viewport that's a very tall, dense card — far more than a staff member scanning quickly needs. Density is uniform across roles: a field operator sees the same chip load as a manager auditing history.

## 3. Tab navigation
`WorkspaceTabs` renders as a horizontally scrolling pill row (`overflow-x: auto`, `flex: 0 0 auto`, `min-height: 44px` at ≤768px — touch targets are fine). The problem is tab count and ordering: staff see 5 tabs ("My Pending Tasks", "Today's Tasks", "My Tasks", "Overdue", "Completed Today"); managers see 6 (same plus "Staff-wise Task Summary"). "My Pending" and "My Tasks" are easy to confuse by label alone, and a first-time user has to horizontally scroll to discover "Completed Today" or the summary tab — there's no visual cue that more tabs exist off-screen.

## 4. Task card readability
Within `.daily-task-card-meta`, all chips share one `.legend-chip` style (`flex-wrap`, equal visual weight, 0.45rem gap) — "Task ID #14", "Date 07/06", "Deadline 07/06 | 18:00", "Done 50%", "Overdue No" and "By System" all look identical in weight and color (only `is_overdue` gets a red `legend-urgent` variant). The single piece of information staff actually act on — due date/time and status — has no visual priority over bookkeeping metadata like Task ID, "By", or source chip. Title and assignee (`<h3>` + `.muted`) are the only elements with real hierarchy; everything below is a flat wall of equal-weight chips and three stacked `<p>` lines (description, timestamps, remarks).

## 5. Staff action buttons
Buttons are functionally solid for touch: `.daily-task-actions button { flex: 1 1 112px }`, raised to `min-height: 42px` and `width: 100%` at ≤768px, and the green "Complete" toggle is `min-height: 44px`. The issue is volume and redundancy. A staff member can see, on one card: a top-right "Complete/Done/Verified" toggle, a status chip, then a row of up to 4 more buttons — Add Remark, Start, Complete (again), Hold — depending on status. "Complete" effectively appears twice (the toggle and the inline button do the same thing), and Edit/"Add Remark" plus Start/Complete/Hold/Verify/Delete can all be visible simultaneously for managers, stacking into 2–3 full-width rows per card on a phone.

## 6. Daily Command Center layout
The opening snapshot uses `.report-grid.daily-task-snapshot-grid` → `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`. At 360–412px that yields 1–2 cards per row, so 6 stat cards (Total, Completed, In Progress, Pending, Overdue, Overall %) wrap into 3–6 rows before any task is visible — a tall "wall of numbers" the user must clear first. There's no condensed/single-row mobile variant; it inherits the same grid as desktop.

## 7. Staff-wise summary layout
"Staff-wise Task Summary" (managers only) reuses the same `auto-fit, minmax(260px, 1fr)` grid as the task cards, collapsing to one column at ≤768px. Each card repeats the staff member's name twice — once in the `<h3>` and again in a `.daily-task-summary-progress` paragraph ("Aman: 3/5 done") — then a 5-chip row (Assigned, Completed, Pending, Delayed, Score%). That name duplication is pure redundancy on a narrow screen, and with many staff this becomes a long single-column scroll with no sorting, filtering, or "needs attention" surfacing (e.g., lowest score or most overdue first).

## 8. EOD review placement
EOD Review is the final panel — same width, same `.panel` chrome, same stat-card grid pattern as the Command Center — appearing identically whether it's 9 AM or 9 PM. It includes a read-only `<textarea>` of auto-generated "owner notes" that staff can't act on. For a mobile staff workflow, an end-of-day summary competing visually with the live task board (and requiring a full scroll-past of the entire board to reach) is mistimed and effectively invisible to the people it might matter most to (owners/managers reviewing remotely).

## 9. Mobile-first workflow for staff
The default experience for non-managers still opens on "My Pending Tasks," which is the right instinct, but the path to *acting* on a task is long: scroll past the 6-card snapshot → past the form/empty-state panel (which shows a "Select a task to update" placeholder when nothing is being edited — dead space for most of the session) → to the actual cards. Editing surfaces a separate "Quick task update" panel above the list rather than inline on the card, so updating one task means the whole layout reflows and the user loses their scroll position in the list.

## 10. What should be hidden / collapsed on mobile
Candidates to hide, collapse, or defer below the fold on phones:
* The Command Center's 6-stat snapshot — collapse to a 1–2 row condensed strip (e.g., Total / Pending / Overdue) with the rest behind a "View all" toggle.
* The empty "Select a task to update" placeholder panel for staff — remove entirely; show the quick-update form inline on the card being edited instead.
* Redundant chips on task cards (Task ID, "By {name}", source chip, "Done {x}%") — move to a collapsed "Details" disclosure per card, surfacing only title, assignee, due date/time, priority, and status by default.
* The duplicated name line in staff-summary cards.
* EOD Review — collapse by default (accordion/"End of day" tab) rather than always-rendered at full size.

---

## Recommendations

**Keep**
Tab-based navigation (with reordering, see below); the green Complete toggle as the single primary action; priority color-coding on the card's left border; the manager create/edit form (but only on demand, not always rendered).

**Remove from mobile**
The duplicate "Complete" affordance (toggle *and* inline button doing the same thing — keep the toggle only); the empty "Select a task to update" placeholder panel; the duplicated staff-name line in summary cards; low-value chips from the default card view (Task ID, "By", source, raw "Done %" — these serve audit/manager needs, not in-the-field staff needs).

**Collapse**
Command Center stats into a compact top strip (2–3 key numbers, rest in an expandable drawer); secondary card metadata (created/updated timestamps, remarks, description) behind a "Show details" toggle so the default card shows only what's needed to decide what to do next; EOD Review into a collapsed end-of-day section/tab rather than an always-visible panel.

**Show first**
For staff: their next-due / overdue tasks and the single action they need (Start → Complete → done), with due date/time and status as the dominant visual elements. For managers: overall completion %, overdue count, and the staff-summary entries that need attention (lowest score / most delayed) surfaced at the top rather than buried in an alphabetical or assignment-order list.

**Best mobile layout for staff**
A single-column "my work today" feed: a slim status strip (assigned / done / overdue counts only) pinned near the top, followed directly by task cards sorted by urgency (overdue → due today → upcoming), each card showing title, due date/time, priority, status, and one primary action button — with everything else (remarks, timestamps, IDs, source) tucked behind an optional expand. Quick status updates should happen inline on the card (a small status-change sheet/menu) rather than reflowing the whole page into a separate edit panel. EOD content should live in its own tab, not inline in the daily scroll.

**Best mobile layout for admin/manager**
Keep the richer toolset, but behind progressive disclosure: snapshot strip → filter/search (collapsed by default, expandable) → task list/board → a separate "Team" or "Summary" tab holding the staff-wise cards (sortable by score/overdue, with the redundant name line removed) → a separate "Review" tab holding EOD data. The create/edit form should open as an on-demand sheet/modal triggered by an "+ New Task" action, rather than always rendering above the list and pushing the board down on every load.

---

*Audit only — no JSX, CSS, or other source files were modified. All observations reference `frontend/src/sections/DailyTasksSection.jsx` and the `.daily-task-*` rules in `frontend/src/styles.css`.*
