# Tiles CRM — UX & Functionality Audit (2026-06-12)

Scope: inventory stability, leads workflow, dashboard UX, production readiness. Fixes were applied surgically — no redesign, no new framework.

## Priority 1 — Inventory Stability

### Why inventory was the most error-prone module
Stock (`products.stock_sqft`) is mutated from four different modules (billing, purchases, purchase costing, lead quotations), each with its own SQL. Three of the four mutations were not NULL-safe and two could drive stock negative. A single product row with `stock_sqft = NULL` (legacy import, partial migration) silently poisoned every calculation that touched it, and concurrent quotation approvals could oversell the same stock.

### Issues found, root causes, and fixes

1. **NULL stock becomes permanently NULL.** `SET stock_sqft = stock_sqft + $1` keeps NULL forever (`NULL + x = NULL`) and the row drops out of valid stock math.
   Fixed in all four mutation sites with `GREATEST(COALESCE(stock_sqft, 0) ± $1, 0)`:
   - `backend/src/routes/billing.js` (`applyInventoryDelta`)
   - `backend/src/routes/purchases.js` (`syncPurchaseInventory`)
   - `backend/src/routes/purchase-costing.js` (`applyLotInventory`, both directions)
   - `backend/src/routes/leads.js` (quotation approval deduction)

2. **Negative stock from quotation approval.** The leads deduction had no floor and no row lock — two simultaneous approvals could both pass the stock check.
   Fix: `SELECT ... FOR UPDATE` on the product row inside the transaction + `GREATEST(..., 0)` floor + NULL-safe comparison (`Number(product.stock_sqft || 0)`). File: `backend/src/routes/leads.js`.

3. **Non-numeric route ids caused 500s.** `PUT/DELETE /api/inventory/:id` passed raw params (e.g. `undefined` from stale frontend state) straight into Postgres → driver error → 500.
   Fix: strict integer validation (`parseProductId`) returning 400. File: `backend/src/routes/inventory.js`. Same class fixed centrally in `backend/src/routes/leads.js` via `router.param` validators for `id`, `leadId`, `followupId`, `taskId`, `quotationId`.

4. **Missing request body crashed validators.** A request without `Content-Type: application/json` leaves `req.body` undefined; `validateProductPayload(undefined)` threw a TypeError → 500.
   Fix: `ensureObjectPayload()` guard in `backend/src/utils/validation.js`, applied to `validateProductPayload` and `validateLeadPayload`.

5. **Business-rule rejections returned 500.** "Insufficient stock" and "product missing" in invoice/quotation creation surfaced as generic 500s, polluting error monitoring and confusing the UI.
   Fix: these errors now carry `statusCode = 409` and the catch blocks honor it. Files: `backend/src/routes/billing.js`, `backend/src/routes/leads.js`.

### Verified safe (no change needed)
- `low_stock_threshold`: SQL already uses `GREATEST(COALESCE(low_stock_threshold, 10), 0)`; box conversion already divides via `NULLIF(sqft_per_box, 0)` (no divide-by-zero). Same pattern in `dashboard.js` and `inventory.js`.
- Frontend stock helpers (`getProductStockBoxes`, `getProductLowStockThreshold`, `isProductLowStock`) already guard NaN/null.
- Duplicate-product detection (`findSimilarProduct`) is NULL-safe via `COALESCE`/`NULLIF`.

### Live production incident (from pm2 logs, 2026-06-11): `GET /api/inventory -> 500`
Diagnosis: every inventory list request 500s while `/api/inventory/options` works. The list query is the only one that depends on `products.low_stock_threshold` (migration 041) and the `purchase_item_batches` table (migration 035) — the production database is behind on migrations. Two compounding defects fixed:

- **No server-side logging.** The route returned the DB error only in the HTTP response body; the pm2 error log stayed empty. All inventory route catches now `console.error` with the full error.
- **Schema drift was fatal.** The list now detects (via `information_schema`) whether `low_stock_threshold` and `purchase_item_batches` exist and degrades gracefully (default threshold 10, no batch number) instead of 500ing. The summary query failure is now non-fatal — products still render.

Permanent remedy on the server: run `scripts\run-migrations.cmd` (applies `backend/migrations/*.sql` in order — it must include 035 and 041), then `pm2 restart tiles-crm-backend`.

## Priority 2 — Leads Workflow

1. **"Open Lead" from Plumbing jobs redirected to the dashboard.** It set the selected lead then navigated to `overview`, which has no lead details panel — the user landed on the dashboard with nothing opened.
   Fix: navigates to `pipeline` via `handleSelectLead` (which also clears create mode). File: `frontend/src/App.jsx`.

2. **Dashboard "Leads" quick action could open the page with a stale lead pre-selected.** It called `setCurrentView("pipeline")` directly, bypassing `handleSelectView` which resets selection.
   Fix: routed through `handleSelectView("pipeline")` — Leads now always opens with no lead selected. File: `frontend/src/App.jsx`.

3. **Inconsistent selection paths in `LeadWorkspaceSection.jsx`.** Two code paths used raw `setSelectedLead` (which does not clear create-lead mode) and one navigated to `overview`. Both now use `onSelectLead` and navigate to `pipeline`.

4. **Verified correct (no change):** `+ New Lead` always opens creation mode (`openNewLeadFlow` clears selection, sets create mode, navigates to pipeline); saving a lead stays on the pipeline (no dashboard redirect); list refreshes never auto-select a lead (`syncSelectedLeadState` keeps `null` when nothing was selected).

## Priority 3 — Dashboard UX (owner view)

Duplications removed; hierarchy now: decision KPIs → owner summaries → data quality → action list.

1. **KPI card grid trimmed from ~19 cards to 11.** "New Leads"/"Hot Leads" were exact duplicates of "Today Walk-ins"/"Open Leads"; module-level counts (Sales Leads, Operations Leads, Open Ops Tasks, Plumbing Value, Fast-moving SKUs) moved conceptually back to their modules where they're actionable.
2. **Owner dashboard panel Row 1 deduplicated.** Today's Sales / Today's Collection / Outstanding Amount repeated the top KPI cards verbatim; removed. Kept Open Complaints and Low Stock Items (the latter carries the "View low stock" action). Rows 2–3 remain summary-only.
3. **"Follow-up discipline" panel deduplicated.** Its Pending/Overdue/Due-today highlight rows repeated the KPI cards; the panel now goes straight to the actionable follow-up list.

Sales and Operations workspace views kept their role-specific cards; only the shared tail was trimmed.

## Priority 4 — Production Readiness

1. **Purchase Center → "Costing" tab opened empty.** Costing data only loaded after the user performed a costing action; opening the tab never triggered a fetch.
   Root cause: `loadDashboard("purchases")` never fetched the costing dataset and the load effects didn't depend on the active tab.
   Fix: extracted `loadPurchaseCostingData()`, called when the costing tab is active, and added `purchaseWorkspaceTab` to both load-effect dependency lists. File: `frontend/src/App.jsx`.
2. **Dead render branch removed:** `{currentView === "purchase_costing" ? null : null}` (the view is redirected to the purchases/costing tab by an effect, which is correct).
3. **Checked and sound:** every sidebar view has a render branch; all backend routers are mounted behind `requireAuth` (owner-summary intentionally uses an internal API key; external daily-tasks router has its own auth); the API 404 handler precedes the SPA fallback; PDF/CSV URLs pass the token as a query param which `requireAuth` accepts; 401 handling clears the session cleanly.

## Files changed
- `backend/src/routes/inventory.js` — id validation on PUT/DELETE
- `backend/src/routes/leads.js` — param validators, FOR UPDATE lock, NULL-safe floor deduction, 409 for stock rejections
- `backend/src/routes/billing.js` — NULL-safe stock delta, 409 for stock rejections
- `backend/src/routes/purchases.js` — NULL-safe stock sync
- `backend/src/routes/purchase-costing.js` — NULL-safe lot inventory (both directions)
- `backend/src/utils/validation.js` — payload object guard
- `frontend/src/App.jsx` — leads navigation fixes, dashboard de-clutter, costing tab data load
- `frontend/src/sections/LeadWorkspaceSection.jsx` — consistent lead selection/navigation

## Remaining recommendations (not implemented)
1. Run `npm run build` in `frontend/` and restart the backend to confirm and deploy; add a smoke test for `POST /api/leads/:id/quotations` with concurrent approvals.
2. One-time data repair: `UPDATE products SET stock_sqft = 0 WHERE stock_sqft IS NULL;` — the code is now NULL-safe, but clean data is still better.
3. Consider a `stock_movements` ledger table; four modules writing `stock_sqft` directly makes auditing a delta history impossible.
4. API error payloads include `error.message` from the DB driver; consider suppressing in production (the global handler already does this — route-level catches don't).
5. The `purchase_costing` entries in `views`/`viewMeta` are vestigial (the view redirects to the purchases costing tab); safe to remove in a future cleanup.
6. `GET /api/inventory` runs an `information_schema` lookup per request for legacy columns; cache the flags at startup if inventory list latency matters.
