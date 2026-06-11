# Role-Based Daily Tasks — UX Mockup & Implementation Recommendation

Mockup and planning only — no code, no file edits, no backend/frontend changes. Builds on `DAILY_TASKS_MOBILE_UX_AUDIT.md` and the prior mockup direction (Staff = flat checklist, Manager = team board, Owner = outcome dashboard).

> `Aiba_OS_v1.xlsx` has now been reviewed (uploaded copy). It is the owner's current manual "AIBA OS" Google-Sheets command center — 12 tabs covering Daily Tasks, Owner Dashboard ("Mission Control"), Performance, Day View, Collection, Bill Transfer, Material Return, Pending Items, EOD Review, Discipline, Task History, and a How-To guide. It is the real-world workflow this redesign should feel like a natural digital upgrade of. Findings that shape this mockup are folded in below and called out where they refine or extend the original direction.

### What AIBA OS reveals (and how it shapes this mockup)

* **The four roles map directly**: Owner = Aditya (👑), Ayush (👔, supervises trucks/unloading/deliveries — manager role), Poonam (💜, sales/cash/billing), Devchand (⚒️, stock/warehouse). The mockups below use these real names and icons.
* **Vocabulary differs slightly from the CRM today** — AIBA OS uses *Priority*: 🔴 Critical / 🟡 High / 🔵 Medium / ⚪ Normal, and *Status*: ☐ Pending / 🔄 In Progress / ✅ Completed / ⚠️ Delayed. The CRM currently uses low/medium/high/urgent and pending/in_progress/hold/completed/verified. **Recommendation: reconcile this vocabulary before implementation** — staff are already trained on AIBA OS's labels, so the CRM's role-based redesign is the moment to align them (e.g. adopt Critical/High/Medium/Normal, and decide whether "Delayed" replaces or sits alongside "Overdue"/"Hold").
* **Owner Dashboard ("Mission Control") is already cross-functional, not task-only** — it pairs today's task counts with a live "Staff — Today's Performance" roster (Assigned / Done / Pending / Score% / Status) and a "Critical Alerts" block. This validates and *extends* the Owner View's "Needs Attention" concept: Aditya's mental model already blends task completion with performance scores and cross-module alerts (collection, pending items, discipline) in one glance — the CRM's Owner View should do the same, not stop at task counts.
* **Performance has a defined formula already in use**: `Score% = (Completed ÷ Assigned × 100) − (Delayed × 5 pts) − (Discipline issues × 10 pts)`, feeding a status label (e.g. "🔴 Needs Improvement"). This is exactly the number that should drive "lowest performer" in both the Manager and Owner views — it's a calculation staff and Aditya already trust, not a new concept to introduce.
* **EOD Review is already a cross-module rollup**, not just a task tally — its auto-summary mixes Tasks Completed/Pending/In Progress/Delayed/Carry-forward *with* Collection Calls Done, Collection Completed, and Critical Pending Items. The CRM's "Needs Attention" / EOD concept should mirror this — pulling in collection and pending-item signals alongside task data — rather than reporting tasks in isolation.
* **A Discipline register sits alongside Performance** (issue type, action taken, warning level, status) and is part of the same monthly score. If/when this surfaces in the CRM, it belongs in the Owner/Manager "Needs Attention" view as a flag (e.g. "Devchand — active Level 1 warning"), not as a separate always-open screen.
* **"Day View" is a workflow staff already rely on** — picking a date and seeing that day's tasks grouped by person. This maps cleanly onto the Staff view's tab bar (Today / Upcoming / Done) and the Manager drill-down — both should support stepping to other dates, not just "today."

Design principle carried through every screen: **a staff member should understand and complete a task in under 3 seconds** — one row, one glance, one tap.

---

## 1. Staff Mobile View — Poonam (💜 sales/billing) / Devchand (⚒️ stock/warehouse)

Flat checklist. One task = one row. Everything below the title is secondary and stays out of the way until tapped. Priority dots and the overdue mark use AIBA OS's existing vocabulary (🔴 Critical / 🟡 High / 🔵 Medium / ⚪ Normal) so staff see the same language they already use today.

```
┌─────────────────────────────────┐
│ Good morning, Poonam      Mon 7 │
│ ▓▓▓▓▓▓░░░░░░░░  4 of 6 done     │
├─────────────────────────────────┤
│ OVERDUE                         │
│ (○) Replace cracked sample…  ⏰ │
│      Was due 9:00 am          ! │
├─────────────────────────────────┤
│ TODAY                           │
│ ( )  Restock display wall A     │
│      11:00 am               ●   │
│                                 │
│ ( )  Call Mehta dealer          │
│      2:30 pm                ●   │
│                                 │
│ (✓)  Morning showroom walk      │
│      Done 9:40 am               │
├─────────────────────────────────┤
│   Today    Upcoming    Done     │
└─────────────────────────────────┘
```

Row anatomy (left to right): big tap circle/checkbox → task title (one line, truncated) → due time directly under the title → a single priority dot on the right → a small "!" overdue mark only when relevant. Nothing else renders on the row.

**Tap the row** (not the circle) → opens a **bottom sheet**, not a new screen, containing:
* Remarks (text entry)
* Hold reason (when marking on hold)
* Details (description, assigned-by, linked lead/project — the "audit" fields, available on demand)

**Tap the circle** → completes the task in place, no navigation.

Hidden from this view entirely: task ID, source badge (Manual/ChatGPT/Claude/Auto), created/updated timestamps, "Done %", "By {system/person}", verification metadata. These remain visible to managers/owners inside the drill-down or bottom-sheet "Details" tab — they simply aren't part of the staff execution loop.

---

## 2. Manager View — Ayush (👔 supervises trucks, deliveries, unloading)

Team board: glanceable totals, a roster of progress cards, and exceptions surfaced — not a feed of every task. Each roster card's score reuses AIBA OS's existing performance formula — `(Completed ÷ Assigned × 100) − (Delayed × 5) − (Discipline × 10)` — so "who needs attention" is calculated the same way Aditya already calculates it monthly, just surfaced daily.

```
┌─────────────────────────────────┐
│ Team board                Mon 7 │
│  18          11         3       │
│ Assigned    Done     Overdue    │
│                                 │
│ [All staff] [Overdue] [Unassg.] │
├─────────────────────────────────┤
│ (PM) Poonam            4/6  >   │
│      ▓▓▓▓▓▓▓░░░                 │
│                                 │
│ (DC) Devchand  ! 2 overdue  >   │
│      ▓▓░░░░░░░░                 │
│                                 │
│ (SP) Sunita            7/8  >   │
│      ▓▓▓▓▓▓▓▓▓░                 │
├─────────────────────────────────┤
│              [+ Assign task]    │
└─────────────────────────────────┘
```

Each staff card shows: avatar initials, name, a thin progress bar, a fraction (done/assigned), and — only when relevant — a red flag like "2 overdue" or "pending: 3". No full task cards render on this screen by default.

**Tap a staff card** → drills into that person's task list, rendered in the *same flat-checklist style* as the staff view (so Ayush sees exactly what Poonam sees, plus manager actions: reassign, change priority, verify).

**Assign Task** → a single button that opens an on-demand sheet/modal (not a form permanently rendered above the board, as today).

Overdue and pending-by-staff are expressed as flags on the roster cards and as the top-strip counts — not as a separate always-open panel.

---

## 3. Owner View — Aditya (👑)

Outcome dashboard — the digital evolution of his existing "Mission Control" sheet. Read-only, exception-first: Aditya should never need to scroll a task list to know whether the day is on track. Per the AIBA OS findings above, his "Needs Attention" list isn't task-only today — his Owner Dashboard already blends task stats with staff Score% and Critical Alerts, and his EOD Review already mixes task counts with collection and pending-item signals — so this view keeps that cross-functional shape rather than narrowing it to tasks alone.

```
┌─────────────────────────────────┐
│ Daily execution overview  Mon 7 │
│                                 │
│   ⟳ 61%      11 of 18 complete  │
│              across 4 staff     │
│                                 │
│   11          4          3      │
│ Completed  Pending   Delayed    │
│                                 │
│ NEEDS ATTENTION                 │
│  ! Devchand — 2 delayed,        │
│    Score 25% (Needs Improvement)│
│  ⏰ 3 tasks unassigned past     │
│    11:00 am                     │
│  ◐ 2 completed tasks awaiting   │
│    verification                 │
│  ⚠ Active discipline warning —  │
│    Devchand (Level 1)           │
│  💰 6 of 10 collection calls    │
│    still pending today          │
│  📌 1 critical pending item     │
│    open (GST RCM)               │
│                                 │
│         View staff report  →   │
└─────────────────────────────────┘
```

Elements: a completion ring, the total/completed/pending/delayed counts (vocabulary aligned to AIBA OS — see note above), and a **Needs Attention** list that does the cross-functional synthesis Aditya already does manually each night: lowest performer (by the same Score% formula), unverified completions, anything stuck past its time, active discipline flags, and the collection / critical-pending-item signals his EOD Review already rolls up. One link out to the full staff-wise report for anyone who wants to go deeper. No individual task list renders by default — this is the "read it in ten seconds before the day starts" screen his sheet was trying to be.

> Scope note: the collection-calls and critical-pending-items lines reuse data that already exists elsewhere in the CRM (per `OWNER_DASHBOARD_AUDIT.md` — `reports/daily`, `purchases`/`leads` collection figures) rather than proposing a new module. Where no CRM equivalent exists yet (e.g. a dedicated Discipline register), flag it as a future addition rather than building it as part of this Daily Tasks redesign — keeping this exercise to "redesign the existing screen," not "add features."

---

## Information architecture

```
Daily Tasks (role-aware entry point)
│
├─ Staff (Poonam, Devchand, …)
│   └─ My day  → Delayed / Today / Upcoming / Done (tabs, date-steppable — see Day View note)
│        └─ Task row → bottom sheet (remarks · hold reason · details)
│
├─ Manager (Ayush)
│   ├─ Team board  → totals · staff roster cards (Score%) · filters
│   │    └─ Staff drill-down → that person's flat checklist + manager actions, by date
│   └─ Assign task → on-demand sheet
│
└─ Owner (Aditya)
    ├─ Daily execution overview → ring · totals · cross-functional needs-attention list
    └─ Staff report (link-out) → full staff-wise breakdown incl. Score%, on demand
```

One shared building block — the **task row** (circle, title, time, priority dot) — is reused everywhere; what changes by role is *grouping* (by time for staff, by person for manager, by exception for owner) and *how much detail sits behind a tap*, not the row's visual complexity.

A second shared concept worth carrying over from AIBA OS: **"Day View."** Staff and Ayush already think in terms of "show me a given day's tasks for a given person." Rather than a separate screen, this becomes a lightweight date-stepper on the Staff tab bar and the Manager drill-down — so "yesterday's carry-forward" or "tomorrow's plan" is one tap away, without adding a new module.

## Mobile layout order (top → bottom, per role)

* **Staff**: greeting + progress bar (with date stepper) → Delayed group → Today group → tab bar (Upcoming/Done load on tap, not pre-rendered)
* **Manager**: totals strip → filter chips → staff roster cards with Score% (sorted: delayed first, then lowest score) → Assign Task action
* **Owner**: completion ring + headline → totals row → cross-functional Needs Attention list (tasks, performance, collection, pending items, discipline) → link to full report

## Desktop layout order (left → right / top → bottom)

* **Staff**: same single-column flow, simply wider — no second column is needed; resist the urge to "fill the space" with extra panels.
* **Manager**: two-column — staff roster + totals on the left, selected staff member's task list on the right (drill-down becomes a persistent split-view instead of full navigation, since desktop has the width for it).
* **Owner**: totals/ring as a top band, Needs Attention as the dominant left/main column, staff-report summary as a secondary right-hand panel — still no raw task list by default.

---

## What to keep

The existing data model and fields (status, priority, due date/time, remarks, verification) — nothing here requires new columns or endpoints. The green "complete" interaction concept (consolidated to one control per row, not two). Role gating that already exists (`canManageAllTasks`, `canVerifyDailyTasks`, `canDeleteDailyTasks`). The EOD/verification concepts — relocated and enriched (per AIBA OS's cross-functional EOD), not deleted. The "Day View" instinct — staff and Ayush already think per-person-per-date.

## What to remove (from default views)

The duplicate complete affordance (toggle *and* inline button). The always-rendered create/edit form panel for managers (replace with an on-demand "Assign task" sheet). The empty "Select a task to update" placeholder for staff. The per-card chip wall (ID, source badge, "By", raw "Done %", created/updated timestamps, verified-by) from the default row — these move into the bottom sheet's "Details" tab, available on tap, not shown by default.

## What to collapse

The 6-stat Command Center snapshot → a single thin progress bar (staff) or a 3-number strip (manager/owner). The Staff-wise Summary → roster cards with progress bars, Score%, and flags, full detail behind drill-down. EOD Review → folded into the Owner's cross-functional "Needs Attention" list (mirroring AIBA OS's own EOD rollup of tasks + collection + pending items) rather than kept as a separate always-visible task-only panel; a dedicated EOD/Review tab can hold the rest for managers who want it.

## Vocabulary reconciliation (flag before build)

AIBA OS priority/status labels (🔴 Critical / 🟡 High / 🔵 Medium / ⚪ Normal and ☐ Pending / 🔄 In Progress / ✅ Completed / ⚠️ Delayed) differ from the CRM's current low/medium/high/urgent and pending/in_progress/hold/completed/verified. Staff are already fluent in AIBA OS's words. This redesign is a natural point to align them — a small decision (which label set wins, and what happens to "Hold"/"Verified," which AIBA OS doesn't have) that should be made explicitly before Phase 1 starts, not discovered mid-build.

---

## Final implementation phases

**Phase 0 — Reconcile vocabulary (decision, not build)**
Agree on one priority/status label set across AIBA OS and the CRM (and what happens to "Hold"/"Verified," which AIBA OS's manual workflow doesn't use). A short decision that prevents staff confusion later — make it before any row component is built.

**Phase 1 — Staff flat checklist (highest frequency, highest impact)**
Build the shared task-row component (circle, title, time, priority dot, delayed mark) and the bottom sheet (remarks / hold reason / details). Replace the staff-facing card grid with the grouped Delayed/Today/Upcoming/Done list, with a simple date stepper (the "Day View" instinct). This alone addresses the "complete a task in under 3 seconds" goal for the largest user group.

**Phase 2 — Manager team board**
Replace the always-on create-task form and staff-summary grid with the totals strip, filterable staff roster cards (showing Score% via the existing formula), on-demand "Assign task" sheet, and drill-down into a staff member's checklist by date (reusing the Phase 1 row component).

**Phase 3 — Owner outcome dashboard**
Add the completion ring, totals, and the cross-functional "Needs Attention" synthesis — lowest performer (by Score%), unverified completions, stuck/unassigned tasks, and (where the data already exists in the CRM per `OWNER_DASHBOARD_AUDIT.md`) collection and critical-pending-item signals, mirroring AIBA OS's own EOD rollup. Link out to a full staff report view for anyone wanting the underlying detail.

**Phase 4 — Consolidation & desktop layout**
Once all three role views share the same row/sheet building blocks, adapt them to desktop's extra width (manager split-view, owner's multi-panel layout) without introducing new components — and retire the legacy always-rendered panels (form, summary grid, EOD block) once their content is fully represented in the new views.

---

*Mockup and recommendation only — no source files, styles, or components were created or modified.*
