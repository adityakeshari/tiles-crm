# Owner Dashboard Implementation Plan

## Objective
Implement an Owner Dashboard in the existing Tiles CRM using current frontend/backend structure and existing APIs first, with no new database changes and no new API creation in Phase 1.

This plan is based on:
- [PROJECT_STRUCTURE.md](C:\Users\hp\Documents\tiles-crm\PROJECT_STRUCTURE.md)
- [MOBILE_AUDIT.md](C:\Users\hp\Documents\tiles-crm\MOBILE_AUDIT.md)
- [MOBILE_BATCH_1_VERIFY.md](C:\Users\hp\Documents\tiles-crm\MOBILE_BATCH_1_VERIFY.md)
- [OWNER_DASHBOARD_AUDIT.md](C:\Users\hp\Documents\tiles-crm\OWNER_DASHBOARD_AUDIT.md)

## Constraints
- Frontend-first implementation
- Reuse existing APIs wherever possible
- No database changes in this phase
- No new backend APIs in this phase
- Preserve current role system
- Preserve current route/view IDs unless absolutely necessary
- Preserve active-view rendering and current memoization patterns
- Keep desktop-first ERP density
- Avoid mobile regressions already identified in the audits

## Existing Architecture Fit
- Main app shell lives in [frontend/src/App.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx)
- Shared shell components already exist:
  - [frontend/src/components/AppHeader.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\components\AppHeader.jsx)
  - [frontend/src/components/Sidebar.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\components\Sidebar.jsx)
  - [frontend/src/components/PageHeader.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\components\PageHeader.jsx)
  - [frontend/src/components/WorkspaceTabs.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\components\WorkspaceTabs.jsx)
- Existing dashboard-like sources already exist in backend route modules and should be reused instead of duplicating calculations.

## Recommended Delivery Strategy

### Phase 1
Build the Owner Dashboard using existing APIs only.

### Phase 2
After Phase 1 is stable, identify true gaps that need new backend support.

This document covers only Phase 1 implementation planning.

## Proposed UI Placement

### Option
Keep the existing `overview` view and add an owner-only dashboard mode/section inside it.

### Recommendation
Do not add a new top-level module yet.

Instead:
- keep `overview` as the landing view
- render an `Owner Dashboard` block only for:
  - `admin`
  - optionally `manager`, if business wants shared visibility

Reason:
- avoids route churn
- avoids sidebar redesign
- uses already-loaded overview data where possible
- aligns with current shell and avoids introducing a separate dashboard fetch architecture too early

## Phase 1 Widget Scope

### Priority 1 widgets
These should be implemented first because the audit confirms they already have usable sources.

1. Today's Sales
2. Today's Collection
3. Outstanding Amount
4. Daily Report Summary
5. Lead Pipeline Summary
6. Open Complaints

### Priority 2 widgets
These should be added in the same dashboard if the UI remains readable.

1. Follow-Up Summary
2. Adhesive Token Summary
3. Project Summary
4. Purchase Summary
5. Plumbing Jobs Summary
6. Expense Summary

### Defer from Phase 1
These should not be promised as fully accurate widgets yet.

1. Low Stock Alerts
Reason: audit found no real low-stock API/definition yet

2. Inventory Value
Reason: current APIs expose stock quantity and product pricing fields, but not a canonical server-side inventory valuation

3. Mason Activity Summary
Reason: available, but lower owner priority than sales/cash/outstanding/complaints

## API Reuse Map

### 1. Overview summary
Use:
- `GET /api/dashboard/summary`

Frontend usage:
- already fits overview/dashboard data flow in [frontend/src/App.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx)

Expected use:
- today sales
- today collection
- pending/outstanding style high-level metrics
- token summary where available

### 2. Lead pipeline and follow-ups
Use:
- `GET /api/leads/dashboard/stats`
- `GET /api/leads/dashboard/followups`

Expected use:
- total leads
- stage counts
- conversion rate
- pending follow-ups
- overdue follow-ups
- today follow-ups

### 3. Complaints
Use:
- `GET /api/complaints`

Expected use:
- open complaints
- urgent complaints
- closed complaints

### 4. Projects
Use:
- `GET /api/projects`

Expected use:
- total projects
- active projects
- completed projects
- pending payment
- project financial rollups already exposed in summary

### 5. Purchases
Use:
- `GET /api/purchases`

Expected use:
- purchase summary
- total amount
- pending payment
- paid amount

### 6. Purchase costing
Use:
- `GET /api/purchase-costing`

Expected use:
- approved lots
- real cost summary
- monthly overhead summary
- cost-side business-health tiles

### 7. Reports
Use:
- `GET /api/reports/daily`

Expected use:
- daily sales
- collection
- expense
- purchase
- token
- cash in/out
- net cash

### 8. Plumbing
Use:
- `GET /api/plumbing`

Expected use:
- total jobs
- ongoing jobs
- completed jobs
- plumbing value

### 9. Inventory
Use:
- `GET /api/inventory`

Expected use:
- total products
- dead stock count
- fast moving count
- total stock quantity
- missing product data counts

Note:
- do not label this as `Low Stock Alerts` in Phase 1 unless a business threshold is explicitly defined

## Canonical Metric Decisions
The audit found overlapping meanings for some numbers. Phase 1 should lock these definitions before UI work starts.

### Outstanding Amount
Use one source only for the primary card.

Recommendation:
- use the same source already trusted in overview if it exists in current frontend flow
- if a combined owner definition is needed, use one endpoint consistently and label it clearly

Do not:
- mix customer pending, dealer outstanding, and owner combined outstanding in one unlabeled card

### Today's Sales / Collection
Recommendation:
- prefer `dashboard/summary` for top cards
- use `reports/daily` as supporting/detail panel

Reason:
- keep top cards lightweight and consistent with the app's current summary architecture

## Frontend Composition Plan

### Layout pattern
Owner Dashboard should follow:
- Header
- Optional compact sub-tabs or filter bar
- KPI cards
- Business health panels
- Supporting tables/lists

Avoid:
- card-inside-card overload
- long stacked report sections without grouping

### Suggested section layout

#### Row 1: Core KPIs
- Today's Sales
- Today's Collection
- Outstanding Amount
- Open Complaints

#### Row 2: Pipeline and operations
- Lead Pipeline Summary
- Follow-Up Summary
- Project Summary
- Plumbing Summary

#### Row 3: Cash and expenses
- Daily Report Summary
- Purchase Summary
- Expense Summary
- Token Summary

#### Row 4: Foundation/health
- Missing Product Data
- Dead Stock Count
- Fast Moving Count
- Costing / Approved Lots summary

## Existing Frontend Data Flow Plan

### Reuse current overview loading first
Phase 1 should first check which of the following are already loaded when `overview` opens:
- dashboard summary
- leads dashboard stats
- inventory summary
- billing summary

Then add only the minimum additional fetches needed for owner widgets:
- complaints summary
- projects summary
- purchases summary
- plumbing summary
- daily report
- purchase costing summary

### Fetching rule
Only fetch these when:
- current view is `overview`
- user is allowed to see owner dashboard

Do not:
- trigger these calls globally for all users
- preload owner-only data in unrelated modules

## Data Shaping Plan
Create a lightweight owner-dashboard view-model layer in frontend only.

Examples:
- `ownerKpis`
- `ownerOperationalSummary`
- `ownerFinanceSummary`
- `ownerFoundationSummary`

This shaping layer should:
- normalize null values
- choose canonical labels
- avoid duplicating business calculations
- only reformat API data for display

Do not:
- recreate backend formulas on the frontend unless only simple formatting is involved

## Role and Visibility Plan

### Phase 1 visibility
Recommendation:
- show Owner Dashboard to `admin`
- optionally allow `manager` if business explicitly wants it

### Non-owner users
- keep current overview experience unchanged
- do not expose owner-heavy financial widgets to operator users unless already allowed

## Mobile / Responsive Requirements
Based on the mobile audit, Owner Dashboard implementation must avoid repeating the same issues.

### Required guardrails
- cards must collapse cleanly at narrow widths
- no table-first design for owner dashboard top sections
- touch targets should follow the improved mobile baseline
- no new horizontal scroll for KPI blocks
- if any detailed tables are added later, use compact desktop-first layout and avoid forcing them into Phase 1 unless necessary

### Recommendation
Phase 1 should be card/panel dominant, not table dominant.

## Performance Guardrails

### Use existing APIs first
Do not build a frontend that fetches every module's full list.

Prefer:
- summary/dashboard endpoints
- bounded report endpoints

### Loading behavior
- owner dashboard loads only on active `overview`
- keep current auto-refresh rules intact if they already exist
- if auto-refresh is enabled for overview, reuse it rather than adding a second polling system

### Memoization
- derive dashboard view models with `useMemo`
- avoid duplicate transformation of the same payload in multiple places

## Known Gaps for Future Phase
These are intentionally not solved in Phase 1.

### 1. Low Stock Alerts
Missing:
- threshold definition
- dedicated backend calculation/query

### 2. Inventory Value
Missing:
- canonical valuation rule
- whether value should use selling rate, purchase rate, landed cost, or real cost

### 3. Unified Owner Summary Endpoint for Frontend
There is an `/api/owner-summary`, but the audit notes it is gated by internal API key rather than the normal frontend auth flow.

Phase 1 recommendation:
- do not adopt it yet
- use current frontend-authenticated module endpoints first

## Suggested Implementation Order

1. Add owner dashboard UI container inside `overview`
2. Reuse already-loaded overview data
3. Add missing summary fetches for complaints, projects, purchases, plumbing, daily report, purchase costing
4. Build KPI cards using canonical metric mapping
5. Build grouped business-health sections
6. Verify role gating
7. Verify mobile/card collapse behavior
8. Verify no hidden extra fetches occur outside `overview`

## Acceptance Criteria

### Functional
- owner dashboard renders without backend changes
- uses existing APIs only
- no database changes
- no new routes required
- no route/view IDs changed

### UX
- desktop-first, compact, readable
- no dashboard clutter
- clear grouping of sales / finance / operations / foundation
- non-owner users do not see owner-only panels unless intended

### Technical
- no module regressions
- no duplicate polling systems
- active-view rendering preserved
- memoized data shaping preserved

## Final Recommendation
Phase 1 should implement an Owner Dashboard inside the existing `overview` view using current summary endpoints, not the internal `/api/owner-summary` route and not new APIs.

That gives:
- fastest delivery
- lowest risk
- no backend auth-model change
- no schema change
- clean separation between immediate owner visibility and later backend consolidation

Phase 2 can then decide whether to:
- formalize a frontend-safe owner-summary endpoint
- add low-stock alerts
- add inventory valuation
- unify overlapping outstanding definitions
