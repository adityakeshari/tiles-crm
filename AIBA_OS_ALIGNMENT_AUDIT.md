# AIBA OS Alignment Audit

## Scope

This audit reviews how the current Tiles CRM Daily Tasks module differs from the role-based AIBA OS mockup, with focus on:

- priority values
- status values
- current summary/report behavior
- dashboard impact
- Daily Tasks module impact
- existing data impact

This is an audit only. No code, database, or API changes are included.

## Reference Used

- `ROLE_BASED_DAILY_TASKS_MOCKUP.md`

## Current CRM Values

### Current Priority Values

Confirmed current CRM daily task priorities:

- `low`
- `medium`
- `high`
- `urgent`

Current evidence:

- backend validation allows only `low`, `medium`, `high`, `urgent`
- daily task ordering logic prioritizes `urgent` first
- frontend Daily Tasks UI currently exposes `Urgent` as the highest priority option

### Current Status Values

Confirmed current CRM daily task statuses:

- `pending`
- `in_progress`
- `completed`
- `verified`
- `hold`

Current behavior:

- active work statuses:
  - `pending`
  - `in_progress`
  - `hold`
- done statuses:
  - `completed`
  - `verified`

This means the current CRM already treats `verified` as a distinct post-completion workflow state, not just a visual label.

## AIBA OS Target Values

From `ROLE_BASED_DAILY_TASKS_MOCKUP.md`, the target vocabulary is:

### Target Priority Values

- `Critical`
- `High`
- `Medium`
- `Normal`

### Target Status Values

- `Pending`
- `In Progress`
- `Completed`
- `Delayed`

## CRM to AIBA OS Mapping

## Priority Mapping

| Current CRM | AIBA OS Equivalent | Notes |
| --- | --- | --- |
| `urgent` | `Critical` | Strong match |
| `high` | `High` | Direct match |
| `medium` | `Medium` | Direct match |
| `low` | `Normal` | Best fit |

Priority alignment is straightforward and low risk.

## Status Mapping

| Current CRM | AIBA OS Equivalent | Notes |
| --- | --- | --- |
| `pending` | `Pending` | Direct match |
| `in_progress` | `In Progress` | Direct match |
| `completed` | `Completed` | Direct match |
| `hold` | `Delayed` | Partial match only |
| `verified` | No direct AIBA OS value | This is the biggest mismatch |

### Important Status Interpretation Risk

`hold` and `delayed` are not the same thing.

- `hold` means work was intentionally paused
- `delayed` usually means late against deadline or carry-forward

Also, `verified` is an explicit business workflow state in CRM, but AIBA OS does not include it in the simplified status set.

So status alignment is not a simple rename exercise.

## Impact on Daily Tasks Module

Current Daily Tasks behavior is tightly coupled to the existing CRM statuses.

### Current Daily Tasks Logic Depends On

- `pending`, `in_progress`, `hold` being treated as active tasks
- `completed`, `verified` being treated as done tasks
- `verified` being available as an admin verification state
- `urgent` being used for priority ranking and summary counts

### Current UI/UX Impact Areas

The following Daily Tasks UX areas rely on the existing values:

- tab filters:
  - Today
  - My Tasks
  - Pending
  - Completed
  - Overdue
- quick action buttons:
  - Start
  - Complete
  - Hold
  - Verify
- EOD review logic
- mobile card chips
- staff-wise progress summary
- completion checkbox behavior

### Specific Daily Tasks Mismatch With AIBA OS

- `Hold` exists in CRM as a first-class action and state
- `Verified` exists as a final review state
- AIBA OS instead emphasizes `Delayed`

Before redesign, a business decision is needed:

1. whether `Delayed` should be a real status
2. whether `Delayed` should remain a derived flag from overdue tasks
3. whether `Verified` should stay as an internal completion sub-state

## Impact on Reports

### Current Summary Formulas

Backend daily task summary currently uses:

- `today_completed_tasks` = status in `('completed', 'verified')`
- `today_pending_tasks` = due today and not in `('completed', 'verified')`
- `pending_tasks` = status not in `('completed', 'verified')`
- `overdue_tasks` = due date before today and not in `('completed', 'verified')`

### Staff Summary Impact

Staff-wise task summary currently reports:

- total tasks
- pending tasks
- completed tasks
- verified tasks
- overdue tasks
- urgent tasks

This means current reports distinguish:

- completed but not yet verified
- fully verified
- overdue as a separate timing dimension

If AIBA OS alignment is implemented later, all of these report meanings must be explicitly preserved or redefined. Otherwise summary counts will drift.

## Impact on Dashboard

### Current Dashboard Task Summary

Owner/Admin overview currently displays daily task metrics using the existing task summary fields:

- `today_total_tasks`
- `today_completed_tasks`
- `today_pending_tasks`
- `overdue_tasks`

### Dashboard Risk

Dashboard counts currently assume:

- `verified` counts as completed
- overdue is separate from status
- pending includes `hold`

If AIBA OS status labels are introduced later without a mapping layer, dashboard cards may:

- undercount completed work
- double count delayed work
- lose verification visibility

## Impact on Existing Data

### Existing Persisted Data Risk

Current historical and live task records may already contain:

- `urgent`
- `hold`
- `verified`

These values cannot be safely reinterpreted without a documented mapping rule.

### Data Compatibility Risks

- existing `hold` tasks may not actually be delayed
- existing `verified` tasks may disappear from UI if only `Completed` is retained
- existing summary reports may change business meaning even if numeric counts still look similar

### Lowest-Risk Compatibility Principle

For future implementation, existing stored values should be preserved first and translated at display/report level before any schema-level normalization is considered.

## Recommended Alignment Direction

### Safest Priority Alignment

Priority values can be aligned at display layer later using:

- `urgent` -> `Critical`
- `high` -> `High`
- `medium` -> `Medium`
- `low` -> `Normal`

This is low risk.

### Safest Status Alignment

Status alignment should happen in two layers:

1. preserve current stored CRM statuses
2. define AIBA OS display semantics on top

Recommended interpretation path for planning:

- `pending` -> `Pending`
- `in_progress` -> `In Progress`
- `completed` -> `Completed`
- `verified` -> `Completed (Verified)` internal state
- `hold` -> keep separate until business confirms whether it means `Delayed`, `Paused`, or `Carry Forward`
- `delayed` should initially be treated as a derived dashboard/report flag, not forced onto existing data

## Pre-Implementation Decisions Needed

Before Phase 1 redesign, the following decisions should be locked:

1. Should `Delayed` be:
   - a real stored status
   - or an overdue-derived flag?
2. Should `Verified` remain:
   - a true workflow state
   - or become a badge under `Completed`?
3. Should `Hold` remain:
   - a valid operator action
   - or be replaced with `Delayed` / `Carry Forward` semantics?
4. Should reports continue to count:
   - `completed + verified` together
   - or separately?

## Audit Conclusion

### What Aligns Easily

- priority values
- most top-level dashboard language
- high-level role-based task presentation

### What Does Not Align Cleanly Yet

- `hold` vs `delayed`
- `verified` as a separate workflow stage
- report semantics that currently depend on CRM-native status buckets

### Recommendation

Do not directly rename statuses yet.

First define an explicit compatibility map between:

- stored CRM task values
- display values for AIBA OS
- summary/report values for owner/manager/staff views

That will preserve existing data and prevent hidden regressions in Daily Tasks, dashboard summaries, and reporting.
