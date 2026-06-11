# Low Stock Implementation Plan

Reference:
- [C:\Users\hp\Documents\tiles-crm\INVENTORY_AND_OUTSTANDING_PLAN.md](C:\Users\hp\Documents\tiles-crm\INVENTORY_AND_OUTSTANDING_PLAN.md)

Date:
- 2026-06-07

Goal:
Plan a simple, practical Low Stock Alert system for Tiles CRM without changing code, schema, or APIs in this phase.

---

## 1. Current Stock Source Audit

### Which table/field stores available stock?

Current stock source:
- table: `products`
- field: `stock_sqft`

Important current-state note:
- despite the field name `stock_sqft`, this is the live stock quantity field currently used by:
  - Inventory
  - Purchase sync
  - Purchase Costing approval stock update
  - Billing stock deduction

So for planning purposes:
- `products.stock_sqft` is the current available stock field
- but its business meaning is only perfectly box/sqft aligned where product/unit discipline is strong

### Which table stores product details?

Current product master table:
- `products`

Useful fields already present:
- `id`
- `name`
- `company_name`
- `category`
- `business_unit`
- `unit`
- `product_size`
- `tile_size`
- `design_code`
- `finish`
- `status`
- `pieces_per_box`
- `sqft_per_box`
- `stock_sqft`

### Is fast-moving flag already available?

Yes.

Current field:
- `products.status`

Confirmed values include:
- `active`
- `fast_moving`
- `dead_stock`

So fast-moving awareness can be added later without schema change.

---

## 2. Threshold Logic Recommendation

## Requested default idea
- Critical: `0–20 boxes`
- Warning: `21–50 boxes`
- Healthy: `51+ boxes`

## Reality check before finalizing

The CRM currently does **not** have a guaranteed separate box-stock field.

Current stock uses:
- `products.stock_sqft`

Current unit can be:
- `box`
- `pcs`
- `sqft`
- and other units depending on product type

So a global “boxes only” threshold is not safe across all products today.

## Recommended practical Phase 1 rule

Use a unit-aware but still simple rule:

### If product unit is `box` or `boxes`
- Critical: `0 to 20`
- Warning: `21 to 50`
- Healthy: `51+`

### If product unit is `sqft`
- Do not silently convert to boxes unless `sqft_per_box` is present
- Recommended Phase 1 behavior:
  - if `sqft_per_box > 0`, derive approximate boxes:
    - `approx_boxes = stock_sqft / sqft_per_box`
    - then apply box thresholds
  - if `sqft_per_box` missing, fallback to simple quantity-based status and label it as approximate

### If product unit is `pcs`
- If `pieces_per_box > 0`, derive approximate boxes:
  - `approx_boxes = stock_sqft / pieces_per_box`
  - then apply box thresholds
- if `pieces_per_box` missing, fallback to simple quantity-based status and label it as approximate

### If unit is anything else
- use fallback quantity rule on raw current stock
- mark alert as generic low stock, not box-perfect

## Recommended stock status output

### Critical
- stock is zero or below critical threshold
- suggested meaning:
  - urgent reorder

### Warning
- stock is above critical but below comfortable threshold
- suggested meaning:
  - reorder soon

### Healthy
- stock is above warning threshold
- suggested meaning:
  - no immediate action

## Recommended Phase 1 threshold engine

Primary target:
- evaluate in “box-equivalent” where possible

Fallback:
- evaluate on raw stock quantity when conversion data is missing

This is the most practical and honest approach for current CRM data quality.

---

## 3. Custom Threshold Decision

## Is product-wise threshold needed?

Yes, eventually.

Reason:
- different categories have different sales velocity
- fast-moving tiles should trigger earlier
- niche sanitary/plumbing items may not need the same threshold

## Recommended future fields

For Phase 2:
- `min_stock_qty`
- `warning_stock_qty`
- `critical_stock_qty`

Recommended meaning:
- `critical_stock_qty`
  - hard urgent threshold
- `warning_stock_qty`
  - reorder soon threshold
- `min_stock_qty`
  - optional owner planning floor / preferred minimum carry level

## Recommendation now

### Phase 1
- no schema change
- use default thresholds only

### Phase 2
- add per-product custom threshold fields

### Phase 3
- add fast-moving / category-aware special rules

---

## 4. API Plan

## Proposed endpoint

`GET /api/inventory/low-stock`

## Proposed response

```json
{
  "rows": [
    {
      "product_id": 12,
      "product_name": "Altis Crema",
      "category": "Floor Tiles",
      "company": "Johnson",
      "size": "2x4",
      "current_stock": 18,
      "unit": "box",
      "fast_moving": true,
      "stock_status": "critical",
      "suggested_action": "Reorder immediately"
    }
  ],
  "summary": {
    "critical_count": 10,
    "warning_count": 24,
    "healthy_count": 180
  }
}
```

## Suggested fields
- `product_id`
- `product_name`
- `category`
- `company`
- `size`
- `current_stock`
- `unit`
- `fast_moving`
- `stock_status`
- `suggested_action`

## Additional useful optional fields later
- `box_equivalent_stock`
- `threshold_basis`
- `critical_threshold`
- `warning_threshold`
- `data_quality_warning`

## Suggested action mapping

### Critical
- `Reorder immediately`

### Warning
- `Plan reorder soon`

### Healthy
- `Stock healthy`

### If packaging conversion is incomplete
- `Verify packaging data`

---

## 5. UI Placement

## Owner Dashboard

Recommended placements:

### KPI / health area
- `Critical Stock Items`
- `Warning Stock Items`

### Detail panel / list
- top 5 or top 10 low stock products

Recommended presentation:
- red badge for critical
- amber badge for warning
- green badge for healthy

## Inventory Page

Recommended placements:

### Inventory Overview / Ledger toolbar area
- quick filter:
  - `Critical`
  - `Warning`
  - `Healthy`

### Inventory report panel
- low stock list/table

This should be close to the Stock Ledger so operator/manager can act quickly.

---

## 6. Implementation Phases

## Phase 1: Default thresholds, no DB change

Scope:
- no schema change
- no custom per-product thresholds
- no complex forecasting

Logic:
- use current stock source
- derive box-equivalent where possible
- otherwise use raw quantity fallback
- thresholds:
  - Critical: `0–20`
  - Warning: `21–50`
  - Healthy: `51+`

Best use:
- owner dashboard visibility
- inventory warning list

## Phase 2: Product-wise custom threshold fields

Scope:
- add:
  - `min_stock_qty`
  - `warning_stock_qty`
  - `critical_stock_qty`

Logic:
- product-specific thresholds override defaults

Best use:
- more accurate reorder planning
- category/product-specific control

## Phase 3: Fast-moving special rules

Scope:
- use `status = fast_moving`
- optionally category-specific threshold multipliers

Possible rule:
- fast-moving products use higher warning thresholds
- dead-stock products may not trigger reorder urgency

Best use:
- smarter owner dashboard planning
- better inventory attention for hot sellers

---

## Recommended Final Approach

### Immediate recommendation
Implement Phase 1 first.

Reason:
- simplest
- works with current data
- no schema change needed
- good enough for owner visibility

### Practical Phase 1 formula

1. Try to convert current stock to approximate boxes
2. If conversion is possible, use:
   - Critical: `0–20 boxes`
   - Warning: `21–50 boxes`
   - Healthy: `51+ boxes`
3. If conversion is not possible:
   - use current stock quantity directly
   - tag as approximate / generic

### Recommended business note
For Tiles CRM, low-stock alerts should be treated as:
- operational attention signals
- not strict procurement math

Until product-wise threshold fields exist, the system should stay simple and transparent.

---

## Final Recommendation Snapshot

### Current stock source
- `products.stock_sqft`

### Product details source
- `products`

### Fast-moving flag
- `products.status = 'fast_moving'`

### Phase 1 thresholds
- Critical: `0–20`
- Warning: `21–50`
- Healthy: `51+`

### Threshold basis
- use box-equivalent where possible
- fallback to raw quantity when conversion data is missing

### Future custom threshold fields
- `min_stock_qty`
- `warning_stock_qty`
- `critical_stock_qty`

### UI placement
- Owner Dashboard
- Inventory page

