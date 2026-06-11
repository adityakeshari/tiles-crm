# Owner Dashboard Review

Review target: Phase 4A owner dashboard implementation inside existing `Overview`

Scope checked:
- API endpoint reuse
- field name compatibility
- null/undefined access safety
- loading/race-condition safety
- `Promise.allSettled` usage

## Summary

Phase 4A is mostly structurally sound, but there are **2 high-risk blockers** before calling it production-safe:

1. A pure `owner` role user is not reliably supported by the existing frontend/backend authorization model.
2. The "Daily Report Summary" card can show a **non-today** date because it reuses shared `dailyReportDate` state from the Reports screen.

There is also **1 medium-risk stale response issue**:

3. `ownerOverviewData` updates are not protected by `requestId` checks, so overlapping overview refreshes can write older results after a newer request.

---

## 1. API endpoint mismatch check

### Finding 1.1: `owner` role visibility does not match backend route access
Status: **High risk**

Frontend shows the owner dashboard for:
- `admin`
- `owner`

Code:
- `frontend/src/App.jsx`
  - `const canViewOwnerDashboard = Boolean(user) && (isAdmin(user) || hasRole(user, "owner"));`

But most reused backend endpoints do **not** allow `owner` role in `requireRole(...)`.

Examples:
- `backend/src/routes/projects.js`
  - `requireRole("admin", "manager", "operations", "accounts")`
- `backend/src/routes/purchases.js`
  - `requireRole("admin", "manager", "accounts", "operations", "operator", "reports")`
- `backend/src/routes/reports.js`
  - `requireRole("admin", "manager", "accounts", "reports", "operations")`
- `backend/src/routes/expenses.js`
  - `requireRole("admin", "manager", "accounts", "operations", "operator")`
- `backend/src/routes/schemes.js`
  - no `owner` in dashboard route access list

Impact:
- `admin` works because `requireRole` grants admins universal access.
- a pure `owner` role user will likely get `403` for several owner dashboard widgets.

Conclusion:
- Phase 4A is effectively **admin-safe**, but **not owner-safe** unless owner users also carry another allowed role in their JWT.

### Finding 1.2: Pure `owner` role may also fail normal sidebar/view visibility
Status: **High risk**

In `frontend/src/App.jsx`, `visibleViews` explicitly handles:
- `admin`
- `manager`
- `sales`
- `operations`
- `token`
- `inventory`
- `accounts`
- `operator`
- `reports`

There is no dedicated `owner` branch in the visible view builder.

Impact:
- a pure `owner` user may not even get the expected overview navigation path consistently.

Conclusion:
- current Phase 4A should be treated as **admin-first**, not truly owner-ready.

### Finding 1.3: No endpoint path mismatch found
Status: **OK**

The reused frontend API functions point to the correct existing routes:
- `api.getDashboardSummary()` -> `/api/dashboard/summary`
- `api.getComplaintsDashboard()` -> `/api/complaints`
- `api.getProjectsDashboard()` -> `/api/projects`
- `api.getPurchases()` -> `/api/purchases`
- `api.getPlumbingDashboard()` -> `/api/plumbing`
- `api.getSchemesDashboard()` -> `/api/schemes`
- `api.getExpensesDashboard()` -> `/api/expenses`
- `api.getDailyReport()` -> `/api/reports/daily`

No endpoint string mismatch was found.

---

## 2. Field name mismatch check

### Finding 2.1: Main field mappings are correct
Status: **OK**

Verified current card mappings:

- Today's Sales
  - `dashboardSummary.sales_today.amount`
- Today's Collection
  - `dashboardSummary.collection_today.amount`
- Outstanding Amount
  - `dashboardSummary.pending_payments.amount`
- Open Complaints
  - `summary.open_complaints`
- Projects Summary
  - `summary.active_projects`
  - `summary.total_projects`
  - `summary.pending_payment`
- Purchase Summary
  - `summary.total_amount`
  - `summary.pending_amount`
  - `summary.paid_amount`
- Plumbing Summary
  - `summary.ongoing_jobs`
  - `summary.total_jobs`
  - `summary.total_plumbing_value`
- Adhesive Token Summary
  - `summary.pending_claims`
  - `summary.pending_token_payout`
  - `summary.paid_token_payout`
- Expense Summary
  - `summary.monthly_expenses`
  - `summary.gross_project_profit`
  - `summary.monthly_net_profit_after_expenses`

No obvious field-name mismatch was found in those widgets.

### Finding 2.2: Daily Report Summary is semantically risky
Status: **Medium risk**

Overview owner dashboard fetch uses:
- `api.getDailyReport({ date: dailyReportDate }, requestOptions)`

But `dailyReportDate` is shared with the Reports screen and is not guaranteed to mean "today".

Impact:
- the Overview card is titled `Daily Report Summary`
- but if the user previously changed the Reports date, this card can show another day
- that is not a null bug, but it is a **metric meaning mismatch**

Conclusion:
- this should be treated as a Phase 4A correctness issue before rollout.

---

## 3. Undefined / null access risk check

### Finding 3.1: Card rendering is mostly null-safe
Status: **OK**

The new overview section uses optional chaining and numeric fallbacks consistently:
- `ownerOverviewData.complaints?.open_complaints || 0`
- `ownerOverviewData.projects?.active_projects || 0`
- `ownerOverviewData.dailyReport?.sales?.amount || 0`
- etc.

This prevents obvious white-screen crashes from missing summaries.

### Finding 3.2: `ownerOverviewHasData` can show cards even with partial data
Status: **Low risk**

`ownerOverviewHasData` becomes true if **any** of these exist:
- `dashboardSummary`
- one owner summary object

That means the section may render with many zero-valued cards when only partial data loaded.

Impact:
- not a crash
- but can look like "real zero" instead of "data unavailable"

Conclusion:
- safe technically, but slightly ambiguous UX.

---

## 4. Loading state / race condition check

### Finding 4.1: `ownerOverviewLoading` is not fully stale-request guarded
Status: **Medium risk**

`loadDashboard()` uses `requestId` / `dashboardLoadRef` for global loading cleanup, but the actual writes:
- `setOwnerOverviewData(...)`
- `setOwnerOverviewError(...)`

inside the overview branch are **not** protected by:
- `dashboardLoadRef.current === requestId`

Impact:
- if two overview loads overlap, an older request can still write owner summary data after a newer request
- this is more likely with:
  - auto-refresh
  - manual refresh
  - quick view switching

Conclusion:
- this is not guaranteed to break often, but it is a real stale-response risk.

### Finding 4.2: Global `loading` and owner loading can drift slightly
Status: **Low risk**

`ownerOverviewLoading` is managed separately from global `loading`.

This is acceptable, but because the owner summary fetch runs after the base overview `Promise.all`, there can be a short period where:
- global overview content has loaded
- owner block is still refreshing

This is not wrong, just worth noting.

---

## 5. `Promise.allSettled` parsing check

### Finding 5.1: `Promise.allSettled` result handling is structurally correct
Status: **OK**

The implementation:
- awaits `Promise.allSettled([...])`
- destructures by fixed index
- checks `result.status === "fulfilled"`
- safely assigns `null` for rejected results

This part is correct.

### Finding 5.2: Partial failure labeling is acceptable
Status: **OK**

The `failedLabels` builder aligns with the settled-result order:
- complaints
- projects
- purchases
- plumbing
- tokens
- expenses
- daily report

This parsing is consistent with the request order.

---

## Overall review outcome

### Safe now
- No endpoint path typo found
- No obvious field-name mismatch in the implemented widgets
- No obvious null/undefined white-screen risk in card rendering
- `Promise.allSettled` parsing is correct

### Must fix before calling Phase 4A complete
1. Owner role authorization mismatch
   - frontend allows `owner`
   - backend reused APIs mostly do not

2. Overview `Daily Report Summary` should not depend on mutable Reports date state
   - it should use today's date explicitly, or clearly label the chosen date

3. `ownerOverviewData` updates should be request-id guarded
   - to avoid stale overview writes during overlapping refreshes

---

## Recommended next action

Before any broader rollout, do a **small stabilization pass** only:

1. Decide whether Phase 4A is:
   - `admin-only for now`
   - or truly `owner + admin`

2. Fix daily report date sourcing for overview

3. Add stale-request guard around owner overview state writes

No new APIs are needed for those fixes.
