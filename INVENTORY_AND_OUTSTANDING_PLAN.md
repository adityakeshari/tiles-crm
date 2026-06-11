# Inventory And Outstanding Plan

Audit date: 2026-06-07

Scope:
- audit only
- no code changes
- no database changes
- no new APIs in this phase
- use only confirmed existing tables and endpoints

---

## Summary

Three owner-dashboard foundation gaps were reviewed:

1. Low Stock Alerts
2. Inventory Value
3. Outstanding Standardization

Current conclusion:
- **Outstanding standardization** is the best Phase 1.5 / Phase 4B priority because multiple formulas already exist and they do not all mean the same thing.
- **Low Stock Alerts** can be added next, but only after choosing a threshold policy because there is no reorder-level field in the current schema.
- **Inventory Value** is possible today using existing cost fields, but the business must choose one cost basis first.

---

# Part 1: Low Stock Alert Audit

## 1. Which table stores stock quantity?

Confirmed table:
- `products`

Confirmed field:
- `products.stock_sqft`

Evidence:
- [C:\Users\hp\Documents\tiles-crm\database.sql](C:\Users\hp\Documents\tiles-crm\database.sql)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\inventory.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\inventory.js)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchases.js)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchase-costing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchase-costing.js)

Important note:
- `stock_sqft` is the current stock field used across inventory, purchase, billing, and costing even when unit types vary
- so low-stock logic must be described carefully as current-stock quantity, not perfect unit-normalized stock intelligence

## 2. Which table stores product master data?

Confirmed table:
- `products`

Product master fields already confirmed:
- identity:
  - `name`
  - `company_name`
  - `design_code`
  - `category`
  - `business_unit`
  - `unit`
  - `product_size`
  - `tile_size`
  - `finish`
- packaging:
  - `pieces_per_box`
  - `sqft_per_box`
  - `weight_per_box`
  - `weight_per_unit`
- pricing/cost:
  - `purchase_rate`
  - `last_purchase_rate`
  - `landed_cost_per_unit`
  - `real_cost_per_unit`
  - `minimum_allowed_rate`
  - `suggested_selling_rate`
  - `pricing_lock`
- stock status:
  - `stock_sqft`
  - `status`

## 3. Is there an existing reorder level field?

Result:
- **No confirmed reorder level field exists**

No current field found like:
- `reorder_level`
- `reorder_qty`
- `reorder_point`

## 4. Is there an existing minimum stock field?

Result:
- **No confirmed minimum stock field exists**

No field found like:
- `minimum_stock`
- `min_stock`
- `safety_stock`

## 5. Is there an existing fast-moving product indicator?

Result:
- **Yes**

Confirmed field:
- `products.status`

Allowed values:
- `active`
- `fast_moving`
- `dead_stock`

Evidence:
- [C:\Users\hp\Documents\tiles-crm\database.sql](C:\Users\hp\Documents\tiles-crm\database.sql)
- [C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js](C:\Users\hp\Documents\tiles-crm\backend\src\utils\validation.js)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\inventory.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\inventory.js)

## Low Stock Alert Recommendation

Because there is no reorder/minimum stock field yet, the system cannot calculate a true business-grade low-stock alert from master data alone.

### Safe temporary formula using existing data only

#### Critical Stock
- `stock_sqft <= 0`

#### Warning Stock
- `stock_sqft between 1 and 5`

#### Healthy Stock
- `stock_sqft >= 6`

This matches the current frontend stock badge logic already used in Stock Ledger.

### Better next-step formula after a future schema/API phase

Recommended future fields:
- `reorder_level`
- `critical_stock_level`
- optional `average_daily_offtake`
- optional `preferred_restock_qty`

### Best practical recommendation for Tiles CRM

Phase 4B should use a two-layer rule:

1. Immediate low-stock alert
   - use current quantity thresholds only

2. Later business-grade alert
   - add product-level reorder controls

### Owner Dashboard placement
- owner dashboard foundation/health row
- inventory health section
- cards:
  - critical stock items
  - warning stock items
  - dead stock items
  - fast-moving items

---

# Part 2: Inventory Value Audit

## 1. Which table stores current stock quantity?

Confirmed:
- `products.stock_sqft`

## 2. Which table stores purchase rate?

Confirmed:
- `products.purchase_rate`
- `products.last_purchase_rate`

Also present in purchase costing item detail:
- `purchase_lot_items.basic_purchase_rate`

## 3. Which table stores landed cost?

Confirmed:
- `products.landed_cost_per_unit`
- `purchase_lot_items.landed_cost_per_unit`

## 4. Which table stores costing data?

Confirmed costing tables:
- `purchase_lots`
- `purchase_lot_items`
- `purchase_lot_suppliers`
- `purchase_lot_charges`

Important product cost fields synced from costing approval:
- `products.last_purchase_rate`
- `products.landed_cost_per_unit`
- `products.real_cost_per_unit`
- `products.minimum_allowed_rate`
- `products.suggested_selling_rate`

Evidence:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchase-costing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\purchase-costing.js)

## 5. Which table stores latest purchase lot cost?

Confirmed:
- item-level lot costs live in `purchase_lot_items`
- approved product-level latest synced cost lives in `products`

This means there are two cost perspectives:

1. lot history detail:
   - `purchase_lot_items.landed_cost_per_unit`
   - `purchase_lot_items.real_cost_per_unit`
   - `purchase_lot_items.final_business_cost_per_unit`

2. current master cost:
   - `products.landed_cost_per_unit`
   - `products.real_cost_per_unit`
   - `products.final_business_cost_per_unit`

## Inventory Value Calculation Options

### Option A: Latest Purchase Cost

Formula:
- `products.stock_sqft * products.last_purchase_rate`

Pros:
- simple
- existing field
- easy to explain

Cons:
- not as accurate as landed or real cost
- ignores freight, overhead, interest, time decay

### Option B: Weighted Average Cost

Formula:
- current stock × weighted average cost across historical purchases/lots

Pros:
- best accounting-style stability
- smoother than latest-cost spikes

Cons:
- not currently available from one confirmed field or one existing endpoint
- would need new query logic and likely a new API

### Option C: Purchase Lot Cost

Formula:
- use current product stock × current synced costing field
- preferred basis:
  - `products.real_cost_per_unit`
  - fallback `products.landed_cost_per_unit`
  - fallback `products.last_purchase_rate`

Pros:
- fits current CRM costing model
- reuses purchase costing approval engine
- aligns with future billing/profit logic already using real cost
- no new table required

Cons:
- product master stores only the latest synced cost, not a weighted blended valuation

## Best recommendation for Tiles CRM

### Recommended valuation basis
**Option C: Purchase Lot Cost using synced product cost fields**

Recommended fallback order:
1. `products.final_business_cost_per_unit` if present and trusted
2. `products.real_cost_per_unit`
3. `products.landed_cost_per_unit`
4. `products.last_purchase_rate`
5. `products.purchase_rate`

Reason:
- this matches the CRM’s current real-cost direction
- it avoids inventing weighted-average logic that does not exist yet
- it is the best fit for owner dashboard visibility

### Recommended inventory value display variants

1. Landed inventory value
   - stock × landed cost

2. Real inventory value
   - stock × real cost

3. Business inventory value
   - stock × final business cost per unit

If only one owner card is shown first:
- prefer **Real Inventory Value**

### Owner Dashboard placement
- inventory health / financial snapshot area
- cards:
  - total real inventory value
  - total landed inventory value
  - dead stock estimated value
  - fast-moving stock value

---

# Part 3: Outstanding Standardization Audit

## Audit goal
Find all current outstanding or pending collection calculations and identify differences.

## Confirmed outstanding-related endpoints and formulas

### 1. `/api/dashboard/summary`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js)

Label used:
- `pending_payments`

Formula:
- for each lead:
  - `q_total = MAX(quotation.final_amount)`
  - `p_total = SUM(payments.amount)`
- outstanding =
  - `SUM(GREATEST(q_total - p_total, 0))`

Tables used:
- `leads`
- `quotations`
- `payments`

Meaning:
- quotation-driven customer pending
- not invoice-driven

### 2. `/api/reports/customer-pending`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js)

Formula:
- per lead:
  - latest quotation final amount
  - minus total payments
- pending =
  - `GREATEST(latest quotation - total payments, 0)`

Tables used:
- `leads`
- `quotations`
- `payments`

Meaning:
- customer pending report
- still quotation-driven

### 3. `GET /api/projects`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js)

Field:
- `pending_payment`

Formula:
- `(tiles_sales_revenue + plumbing_revenue - received_payment)`
- clamped with `GREATEST(..., 0)`

Tables used:
- `projects`
- `quotations`
- `payments`
- `plumbing_jobs`
- `plumbing_materials`
- token claims through project costing context

Meaning:
- project-level pending across tiles + plumbing revenue

### 4. `/api/leads/dashboard/stats`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js)

Field:
- `pending_collections`

Formula:
- `SUM(GREATEST(quoted_amount - total_paid, 0))`

Tables used:
- `quotations`
- `payments`

Meaning:
- again quotation-driven pending collections

### 5. `/api/billing`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js)

Fields:
- `remaining_amount`
- customer ledger pending values

Formula:
- invoice-based:
  - `remaining_amount = grand_total - received/payments`

Tables used:
- `invoices`
- `invoice_items`
- `invoice_payments`

Meaning:
- actual invoice receivable for the billing module
- different from quotation-based pending

### 6. `/api/owner-summary`
Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\owner-summary.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\owner-summary.js)

Fields:
- `customerOutstanding`
- `dealerOutstanding`
- `totalOutstanding`

Formula:
- customer outstanding:
  - quotation-driven pending
- dealer outstanding:
  - `SUM(dealers.outstanding_payment)`
- total outstanding:
  - customer outstanding + dealer outstanding

Tables used:
- `leads`
- `quotations`
- `payments`
- `dealers`

Meaning:
- broader owner-style outstanding, not billing-ledger outstanding

### 7. Dealers module
Source:
- [C:\Users\hp\Documents\tiles-crm\database.sql](C:\Users\hp\Documents\tiles-crm\database.sql)
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\dealers.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\dealers.js)

Field:
- `dealers.outstanding_payment`

Meaning:
- manually maintained or module-specific dealer receivable
- separate from lead/project/invoice pending

## Where current inconsistencies exist

### Inconsistency 1: Quotation vs Invoice
- dashboard summary uses quotations + payments
- billing module uses invoices + invoice payments

These are not the same business object.

### Inconsistency 2: Lead-level vs Project-level
- leads pending uses quotation-only
- projects pending uses tiles + plumbing revenue minus payments

This can produce different totals for the same customer journey.

### Inconsistency 3: Customer outstanding vs dealer outstanding
- owner summary combines both
- dashboard summary currently does not

So one “Outstanding” card can mean different things depending on endpoint.

### Inconsistency 4: Latest quotation vs max quotation
- some logic uses latest quotation
- some logic uses max quotation

Those are not equivalent if quotations were revised downward or duplicated.

## Recommended ONE canonical formula

### Recommendation
Use **invoice-ledger receivable** as the long-term canonical formula for showroom outstanding wherever actual billing exists.

Canonical formula:

`Outstanding = Invoice Grand Total - Payments Received - Credit Notes - Adjustments`

### Important current-state limitation
Current confirmed schema/endpoints do not yet show:
- credit note table
- adjustment table

So the safe current formula is:

`Outstanding = Invoice Grand Total - Invoice Payments Received`

using:
- `invoices.grand_total`
- `invoices.remaining_amount`
- `invoice_payments.amount`

### Why this is best
- invoice is the final customer-facing commercial document
- better than quotation-based pending once billing is in use
- aligns with billing ledger and payment flow
- easier for owner dashboard standardization

### Transitional rule recommended

Until a full invoice-first rollout is confirmed across all flows:

1. Owner dashboard should clearly label:
   - `Quotation Pending`
   - or `Invoice Outstanding`

2. Do not mix:
   - quotation pending
   - project pending
   - dealer outstanding
in one unlabeled number

---

# Part 4: Implementation Plan

## Priority 1: Outstanding Standardization

### Why first
- biggest semantic inconsistency today
- directly affects owner trust in dashboard numbers

### Existing tables
- `invoices`
- `invoice_payments`
- `leads`
- `quotations`
- `payments`
- `projects`
- `dealers`

### Existing APIs reusable?
Yes, for audit and comparison:
- `/api/dashboard/summary`
- `/api/reports/customer-pending`
- `/api/projects`
- `/api/billing`
- `/api/owner-summary` (internal, not frontend Phase 1)

### New API needed?
Eventually: **Yes, recommended**

Reason:
- one canonical outstanding endpoint should expose clearly labeled owner metrics:
  - invoice outstanding
  - quotation pending
  - dealer outstanding
  - total outstanding if business wants combined view

### UI placement in Owner Dashboard
- Row 1 core KPI
- owner finance detail drawer / tooltip later

### Recommended first implementation step
- standardize the label and source first
- do not combine formulas silently

---

## Priority 2: Low Stock Alerts

### Existing tables
- `products`

### Existing APIs reusable?
Yes:
- `/api/inventory`

Already reusable fields:
- `stock_sqft`
- `status`
- `fast_moving_count`
- `dead_stock_count`
- `total_stock_sqft`

### New API needed?
Not immediately

For Phase 1:
- existing inventory endpoint is enough for threshold-based alerts

Later:
- maybe yes, if alert rules become more advanced or per-product thresholds are added

### UI placement in Owner Dashboard
- inventory / health row
- cards:
  - out of stock count
  - warning stock count
  - dead stock count
  - fast-moving count

### Recommended first implementation step
- implement simple threshold alerts using current stock quantity only

---

## Priority 3: Inventory Value

### Existing tables
- `products`
- `purchase_lot_items`
- `purchase_lots`

### Existing APIs reusable?
Partially yes:
- `/api/inventory`
- `/api/purchase-costing`

### New API needed?
Likely **Yes**, if owner dashboard needs:
- one clean total inventory value number
- segmented values by category / dead stock / fast-moving

Reason:
- existing APIs expose raw pieces needed
- but not one canonical aggregated valuation payload

### UI placement in Owner Dashboard
- finance / inventory value section
- cards:
  - total real inventory value
  - dead stock value
  - fast-moving value

### Recommended first implementation step
- choose valuation basis first:
  - recommended: `stock × real_cost_per_unit` fallback chain

---

## Final Recommendation Order

### Phase 4B sequence

#### 1. Outstanding Standardization
First because owner-facing trust depends on this most.

#### 2. Low Stock Alerts
Second because it is easy to add with current data, even before schema expansion.

#### 3. Inventory Value
Third because it needs a business decision about valuation method before implementation.

---

## Recommended Decision Snapshot

### Low Stock
- current temporary formula:
  - critical: `<= 0`
  - warning: `1 to 5`
  - healthy: `>= 6`

### Inventory Value
- recommended basis:
  - `stock_sqft × real_cost_per_unit`
  - fallback to `landed_cost_per_unit`
  - fallback to `last_purchase_rate`

### Outstanding
- recommended long-term canonical formula:
  - `invoice grand total - invoice payments received`
- do not silently combine with quotation pending or dealer outstanding

