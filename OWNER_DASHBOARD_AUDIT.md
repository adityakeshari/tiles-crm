# Owner Control Dashboard — Data Source Audit

Read-only audit. No code, files, migrations, or dependencies were changed.

---

## STEP 1: Route File Audit

### File: inventory.js
Routes:
* GET /options
* GET / (paginated product list + summary)
* GET /debug (admin/manager — search-by-name diagnostic)
* POST /
* PUT /:id
* DELETE /:id

Tables Touched: `products`, `purchases`, `purchase_item_batches`

Summary/Aggregation Endpoints:
* GET / → returns `summary`: total_products, fast_moving_count, dead_stock_count, total_stock_sqft, missing_company/size/weight/pricing/packaging counts

**Note: there is no `/low-stock` route or any low-stock/reorder-point query in this file.** The only stock-health figures are `fast_moving_count` and `dead_stock_count` (status-based) and `total_stock_sqft` (a raw sum).

### File: complaints.js
Routes:
* GET / (cached, list + summary)
* POST /
* PUT /:id
* POST /:id/create-operations-task
* DELETE /:id (admin)

Tables Touched: `complaints`, `leads`, `users`, `operations_tasks`

Summary/Aggregation Endpoints:
* GET / → `summary`: total_complaints, plumbing_complaints, tiles_complaints, open_complaints, urgent_complaints, closed_complaints

### File: leads.js
Routes:
* GET /dashboard/stats (cached)
* GET /dashboard/followups (cached)
* GET /dashboard/operations
* GET /
* POST /
* PUT /:id
* DELETE /:id (admin)
* GET /:id/followups
* POST /:id/followups
* PUT /:leadId/followups/:followupId
* GET /:id/payments
* POST /:id/payments
* GET /:id/operations-tasks
* POST /:id/operations-tasks
* PUT /:leadId/operations-tasks/:taskId
* GET /:id/quotations
* POST /:id/quotations
* GET /:leadId/quotations/:quotationId/pdf

Tables Touched: `leads`, `payments`, `quotations`, `followups`, `users`, `dealers`, `operations_tasks`

Summary/Aggregation Endpoints:
* GET /dashboard/stats → total_leads, today_walkins, stage_counts, source_counts, conversion_rate, monthly_revenue, collected_payments, pending_collections, pending/overdue/todays_followups, staff_performance, dealer totals (incl. dealer_outstanding), open/delayed_operations_tasks
* GET /dashboard/followups → followup board list
* GET /dashboard/operations → operations task board

### File: purchases.js
Routes:
* GET /by-truck
* GET / (list + summary, filterable by search/date/payment_status)
* GET /product-intelligence/:productId
* POST /
* PUT /:id
* DELETE /:id (admin)

Tables Touched: `purchases`, `purchase_item_batches`, `users`

Summary/Aggregation Endpoints:
* GET / → `summary`: total_count, total_amount, net_amount, gst_amount, pending_amount, paid_amount

### File: purchase-costing.js
Routes:
* GET / (list + summary + reports)
* GET /:id
* POST /
* PUT /:id
* PUT /:id/approve
* PUT /:id/cancel

Tables Touched: `purchase_lots`, `purchase_lot_suppliers`, `purchase_lot_items`, `products`, `expenses`, `invoices`/`invoice_items`, `users`

Summary/Aggregation Endpoints:
* GET / → `summary`: total_lots, approved_lots, cancelled_lots, total_purchase_value, total_freight_cost, total_unloading_cost, total_allocated_charges, total_net_usable_quantity, total_real_cost, monthly_overhead figures, total_final_business_cost; plus report sections (lot-wise, supplier-wise, product-wise landed cost, damage/decay, freight allocation, time decay, interest burden, low-margin warnings)

### File: reports.js
Routes:
* GET /daily
* GET /sales
* GET /collection
* GET /customer-pending
* GET /token
* GET /mason-token-summary

Tables Touched: `quotations`, `payments`, `expenses`, `purchases`, `adhesive_token_claims`, `followups`, `leads`, `masons`

Summary/Aggregation Endpoints:
* GET /daily → single-day rollup: sales, collection, expense, purchase, tokens, followups (counts+amounts), cash_in, cash_out, net_cash
* GET /customer-pending → outstanding-by-lead report (`pending_amount = quoted - paid`)
* GET /mason-token-summary → per-mason aggregate: total/pending/paid claims and amounts

### File: billing.js
Routes:
* GET / (cached, list + summary + reports)
* GET /:id
* GET /:id/pdf
* POST /
* PUT /:id
* PUT /:id/submit-approval
* PUT /:id/approval
* PUT /:id/cancel
* POST /:id/payments
* DELETE /:id (admin)

Tables Touched: `invoices`, `invoice_items`, `invoice_payments`, `users`, `expenses`, `leads`, `quotations`, `projects`, `products`

Summary/Aggregation Endpoints:
* GET / → `summary`: today_billing, total_bills, paid_bills, pending_bills, monthly_billing, todays_collection, monthly_overhead, gross_profit, net_profit; plus reports (daily_billing, product_wise_sales, customer_ledger, payment_report)

### File: plumbing.js
Routes:
* GET / (dashboard: plumbers + jobs + summary)
* GET /lead/:leadId
* POST /plumbers
* PUT /plumbers/:id
* DELETE /plumbers/:id (admin)
* POST /jobs
* PUT /jobs/:id
* POST /jobs/:id/materials

Tables Touched: `plumbers`, `plumbing_jobs`, `plumbing_materials`, `leads`

Summary/Aggregation Endpoints:
* GET / → `summary`: total_plumbers, total_jobs, ongoing_jobs, completed_jobs, total_plumbing_value

### File: projects.js
Routes:
* GET / (admin/manager/operations/accounts — list + summary, cached)
* GET /:id/invoice/pdf
* POST /
* PUT /:id
* POST /:id/dispatches
* PUT /:projectId/dispatches/:dispatchId

Tables Touched: `projects`, `dispatches`, `quotations`, `payments`, `plumbing_jobs`, `adhesive_token_claims`, `leads`, `users`, `masons`

Summary/Aggregation Endpoints:
* GET / → `summary`: total_projects, active_projects, completed_projects, total_received_payment, pending_payment, total_net_profit, total_tiles/plumbing_revenue, pending/paid_token_amount, pending_dispatch_items, pending_plumbing_jobs

---

## STEP 2: Server Router Mapping

(from `backend/src/app.js`)

| Mount Path | Router File | Auth Gate |
| --- | --- | --- |
| /api/auth | auth.js | none |
| /api/billing | billing.js | requireAuth |
| /api/complaints | complaints.js | requireAuth |
| /api/dashboard | dashboard.js | requireAuth |
| /api/owner-summary | owner-summary.js | **requireInternalApiKey (not requireAuth)** |
| /api/leads | leads.js | requireAuth |
| /api/dealers | dealers.js | requireAuth |
| /api/expenses | expenses.js | requireAuth |
| /api/exports | exports.js | requireAuth |
| /api/inventory | inventory.js | requireAuth |
| /api/notifications | notifications.js | requireAuth |
| /api/plumbing | plumbing.js | requireAuth |
| /api/purchase-costing | purchase-costing.js | requireAuth |
| /api/projects | projects.js | requireAuth |
| /api/purchases | purchases.js | requireAuth |
| /api/reports | reports.js | requireAuth (+ requireRole admin/manager/accounts/reports/operations) |
| /api/schemes | schemes.js | requireAuth |
| /api/suppliers | suppliers.js | requireAuth |
| /api/users | users.js | requireAuth |

**Dashboard routes**: `/api/dashboard` (`GET /summary`), `/api/owner-summary` (`GET /`), plus dashboard-style aggregate endpoints embedded in module routers (`/api/leads/dashboard/stats`, `/api/reports/daily`, `/api/inventory`, `/api/billing`, `/api/projects`, `/api/complaints`, `/api/plumbing`, `/api/purchases`, `/api/purchase-costing`).

**Owner summary routes**: `/api/owner-summary` — the only route in the app gated by `requireInternalApiKey` instead of session auth, suggesting it was built for an external/service-to-service consumer rather than the in-app frontend.

**Internal API routes**: `/api/owner-summary` (via `requireInternalApiKey` middleware).

**Admin-only routes**: `DELETE` endpoints on inventory, complaints, leads, purchases, billing, plumbing/plumbers (all gated `requireRole("admin")`); `/api/reports/*` is gated to `admin, manager, accounts, reports, operations` roles.

---

## STEP 3: Migration / Table Audit

Table: products
Migration: 003_inventory_module.sql
Relevant Columns:
* status (active/fast_moving/dead_stock)
* stock_sqft
* price_per_sqft
* landed_cost_per_unit / minimum_allowed_rate
* created_at

Table: complaints
Migration: 008_complaints_management.sql
Relevant Columns:
* business_unit
* category
* priority
* status
* due_date
* assigned_to
* created_at / resolved_at

Table: leads
Migration: 002_expand_tiles_crm_modules.sql
Relevant Columns:
* status
* lead_source
* assigned_to
* created_at

Table: payments
Migration: 002_expand_tiles_crm_modules.sql
Relevant Columns:
* lead_id
* amount
* payment_type
* created_at

Table: quotations
Migration: 002_expand_tiles_crm_modules.sql
Relevant Columns:
* lead_id
* final_amount
* status
* created_at

Table: followups
Migration: 002_expand_tiles_crm_modules.sql
Relevant Columns:
* lead_id
* status
* followup_date
* created_at

Table: dealers
Migration: 002_expand_tiles_crm_modules.sql
Relevant Columns:
* outstanding_payment
* category

Table: purchases
Migration: 020_purchase_entries.sql (backend/migrations)
Relevant Columns:
* purchase_date
* quantity / amount / gst_amount / total_amount
* payment_status
* created_at

Table: purchase_costing (implemented as `purchase_lots`)
Migration: 027_purchase_costing_module.sql (backend/migrations)
Relevant Columns:
* status
* arrival_date
* total_purchase_value
* total_net_usable_quantity
* created_at
(No table literally named `purchase_costing` or `purchase_items` exists — costing is modeled via `purchase_lots` + `purchase_lot_suppliers`/`purchase_lot_items`.)

Table: adhesive_token_claims
Migration: 014_adhesive_token_claims.sql
Relevant Columns:
* status
* verification_status
* total_token_amount
* project_id
* payment_date
* created_at

Table: mason_activity_logs
Migration: 017_complete_mason_token_repair.sql (backend/migrations)
Relevant Columns:
* mason_id
* action
* created_at

Table: plumbing_jobs
Migration: 011_plumbing_services.sql
Relevant Columns:
* lead_id / plumber_id
* status
* service_charge
* scheduled_for

Table: projects
Migration: 012_owner_projects_finance.sql
Relevant Columns:
* lead_id
* status
* created_at

Table: dispatches
Migration: 012_owner_projects_finance.sql
Relevant Columns:
* project_id
* quantity
* status

Table: operations_tasks
Migration: 006_operations_tasks.sql
Relevant Columns:
* title
* status
* assigned_to
* created_at

Table: expenses
Migration: 012_owner_projects_finance.sql
Relevant Columns:
* category
* amount
* expense_date

**Not found in migrations** (searched, no `CREATE TABLE`/`ALTER TABLE` matches): `stock_movements`, `stock_ledger`, `purchase_items`, `purchase_costing` (as a table name — implemented as `purchase_lots`).

---

## STEP 4: Owner Dashboard Data Inventory

| Dashboard Widget | Endpoint | Database Table | Data Available? |
| --- | --- | --- | --- |
| 1. Today's Sales | GET /api/dashboard/summary, GET /api/owner-summary, GET /api/reports/daily | quotations | Yes |
| 2. Today's Collection | GET /api/dashboard/summary, GET /api/owner-summary, GET /api/reports/daily | payments | Yes |
| 3. Outstanding Amount | GET /api/dashboard/summary (`pending_payments`), GET /api/owner-summary (`outstanding`), GET /api/reports/customer-pending | leads + quotations + payments (+ dealers) | Yes (3 slightly different calculations exist — see note below) |
| 4. Low Stock Alerts | — none — | products | **No** — only `fast_moving_count`/`dead_stock_count`/`total_stock_sqft`; no low-stock threshold or `/low-stock` route exists |
| 5. Inventory Value | GET /api/inventory (`summary.total_stock_sqft`) | products | Partial — stock quantity is summarized; no monetary "inventory value" (qty × rate) is computed server-side |
| 6. Open Complaints | GET /api/complaints (`summary.open_complaints`, `urgent_complaints`) | complaints | Yes |
| 7. Lead Pipeline Summary | GET /api/leads/dashboard/stats (`stage_counts`, `conversion_rate`, `source_counts`) | leads | Yes |
| 8. Follow-Up Summary | GET /api/leads/dashboard/stats (pending/overdue/todays_followups), GET /api/leads/dashboard/followups, GET /api/owner-summary (`followups`) | followups | Yes |
| 9. Purchase Summary | GET /api/purchases (`summary`), GET /api/reports/daily (`purchase`) | purchases | Yes |
| 10. Daily Report Summary | GET /api/reports/daily | quotations, payments, expenses, purchases, adhesive_token_claims, followups | Yes |
| 11. Plumbing Jobs Summary | GET /api/plumbing (`summary`) | plumbing_jobs, plumbers | Yes |
| 12. Project Summary | GET /api/projects (`summary`) | projects, dispatches | Yes |
| 13. Adhesive Token Summary | GET /api/dashboard/summary (`token_pending`/`token_paid_month`), GET /api/owner-summary (`tokenMasonActivity`), GET /api/reports/mason-token-summary, GET /api/reports/token | adhesive_token_claims | Yes |
| 14. Mason Activity Summary | GET /api/owner-summary (`tokenMasonActivity.masonActivityCountToday`), GET /api/reports/mason-token-summary | mason_activity_logs, masons | Yes |
| 15. Expense Summary | GET /api/reports/daily (`expense`) — no dedicated `/api/expenses` summary route was inspected in this pass | expenses | Yes (via daily report; a standalone expenses dashboard route may also exist but was outside this audit's file list) |

**Outstanding note**: three endpoints compute "outstanding" with different scope — `dashboard/summary.pending_payments` (customer-only), `owner-summary.outstanding` (customer + dealer combined), `reports/customer-pending` (per-lead breakdown). Pick one canonical definition before building the widget.

---

## STEP 5: Owner Dashboard Recommendation

### Priority 1 Widgets (core daily owner view — all backed by confirmed live aggregates)
* **Today's Sales** — Endpoint: `/api/dashboard/summary` or `/api/owner-summary` · Table: `quotations` · Reuse possible: Yes · New API required: No
* **Today's Collection** — Endpoint: `/api/dashboard/summary` or `/api/owner-summary` · Table: `payments` · Reuse possible: Yes · New API required: No
* **Outstanding Amount** — Endpoint: `/api/owner-summary` (combined customer+dealer) · Table: `leads`/`quotations`/`payments`/`dealers` · Reuse possible: Yes (pick one canonical source first) · New API required: No
* **Daily Report Summary** — Endpoint: `/api/reports/daily` · Table: multi (quotations/payments/expenses/purchases/tokens/followups) · Reuse possible: Yes · New API required: No
* **Lead Pipeline Summary** — Endpoint: `/api/leads/dashboard/stats` · Table: `leads` · Reuse possible: Yes · New API required: No
* **Open Complaints** — Endpoint: `/api/complaints` · Table: `complaints` · Reuse possible: Yes · New API required: No

### Priority 2 Widgets (operational health — backed by existing aggregates, currently fetched in other views)
* **Follow-Up Summary** — Endpoint: `/api/leads/dashboard/stats` or `/api/owner-summary` · Table: `followups` · Reuse possible: Yes · New API required: No
* **Adhesive Token Summary** — Endpoint: `/api/dashboard/summary` (`token_pending`/`token_paid_month`) or `/api/reports/mason-token-summary` (richer, per-mason) · Table: `adhesive_token_claims` · Reuse possible: Yes · New API required: No
* **Project Summary** — Endpoint: `/api/projects` · Table: `projects`/`dispatches` · Reuse possible: Yes · New API required: No
* **Purchase Summary** — Endpoint: `/api/purchases` or `/api/reports/daily` · Table: `purchases` · Reuse possible: Yes · New API required: No
* **Plumbing Jobs Summary** — Endpoint: `/api/plumbing` · Table: `plumbing_jobs`/`plumbers` · Reuse possible: Yes · New API required: No
* **Expense Summary** — Endpoint: `/api/reports/daily` (`expense`) · Table: `expenses` · Reuse possible: Yes · New API required: No

### Priority 3 Widgets (nice-to-have / needs definition work)
* **Mason Activity Summary** — Endpoint: `/api/owner-summary` or `/api/reports/mason-token-summary` · Table: `mason_activity_logs`/`masons` · Reuse possible: Yes · New API required: No
* **Inventory Value** — Endpoint: `/api/inventory` (only raw stock quantity today, not ₹ value) · Table: `products` · Reuse possible: Partially (would need a client-side qty × rate calc, or a new server aggregate for a true monetary figure) · New API required: No (workable client-side) / Yes (for an accurate server-computed value)
* **Low Stock Alerts** — Endpoint: none exists · Table: `products` · Reuse possible: No — no low-stock concept is defined anywhere in the code (only `fast_moving`/`dead_stock` status flags and a raw `stock_sqft` total) · New API required: **Yes** — a low-stock/reorder-threshold definition and query would need to be added; out of scope for an audit-only pass

### Build approach (planning note, not an implementation directive)
Most Priority 1–2 widgets can be assembled by reusing data the app already loads for the Overview and Reports views (`dashboardSummary`, `stats`, `projectSummary`, plus one new fetch to `/api/complaints`). `/api/owner-summary` is the most complete single-call source but is currently unused by the frontend and sits behind a different auth model (`requireInternalApiKey`) — adopting it would require resolving that access-model mismatch first. The two Priority 3 gaps (Low Stock Alerts, true Inventory Value) are the only items that would require new backend work.

---

*Audit only — no source files, migrations, dependencies, or configuration were modified.*
