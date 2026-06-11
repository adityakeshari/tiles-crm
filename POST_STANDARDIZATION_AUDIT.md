# Post Standardization Audit

Audit date: 2026-06-07

Reference:
- [C:\Users\hp\Documents\tiles-crm\OUTSTANDING_STANDARDIZATION_REPORT.md](C:\Users\hp\Documents\tiles-crm\OUTSTANDING_STANDARDIZATION_REPORT.md)

Goal:
Verify that Outstanding Standardization introduced no hidden regression.

Scope checked:
1. Dashboard Summary
2. Owner Dashboard
3. Leads Dashboard
4. Customer Pending Report
5. Billing Module
6. Dealer Outstanding
7. Project Pending Payment
8. Daily Report

---

## Canonical Formula Verified

Current canonical outstanding formula:

`Outstanding = Approved Invoice Grand Total - Approved Invoice Payments Received`

Current authoritative field used:
- `invoices.remaining_amount`

Reason this is safe in current schema:
- `remaining_amount` is recalculated in billing updates/payments
- current billing route clamps it with `GREATEST(..., 0)`
- no separate credit note / adjustment tables exist yet

---

## 1. Dashboard Summary

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\dashboard.js)

Current formula:
- `SUM(i.remaining_amount)` from `invoices`
- `WHERE i.status = 'approved'`

Validation result:
- Uses intended formula
- Excludes draft / pending approval / rejected / cancelled invoices
- No double counting inside this endpoint
- No negative outstanding issue because `remaining_amount` is already clamped by billing logic

Assessment:
- **Pass**

---

## 2. Owner Dashboard

Frontend source:
- [C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx](C:\Users\hp\Documents\tiles-crm\frontend\src\App.jsx)

Current usage:
- owner outstanding card reads:
  - `dashboardSummary.pending_payments.amount`

Validation result:
- Owner Dashboard now inherits the canonical source from dashboard summary
- No separate custom outstanding calculation remains in the owner overview UI
- No double counting at the frontend layer

Assessment:
- **Pass**

Note:
- `/api/owner-summary` was also standardized, but current Phase 4A owner UI does not depend on it

---

## 3. Leads Dashboard

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\leads.js)

Current field:
- `pending_collections`

Current formula:
- `SUM(invoices.remaining_amount)`
- `WHERE status = 'approved'`

Validation result:
- Uses intended formula
- Excludes non-approved invoices
- No negative outstanding issue
- No hidden quotation-based fallback remains in this field

Regression note:
- **Meaning changed**
  - old: quotation pending
  - new: invoice outstanding

This is not a code bug, but it is a business-meaning shift for anyone reading `pending_collections`.

Assessment:
- **Pass with semantic monitoring**

---

## 4. Customer Pending Report

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js)

Current formula:
- grouped approved invoices
- `SUM(grand_total)`
- `SUM(received_amount)`
- `SUM(remaining_amount)`

Validation result:
- Uses intended formula
- Excludes draft / pending approval / rejected / cancelled invoices
- Uses invoice-native received/outstanding fields
- `HAVING SUM(remaining_amount) > 0` prevents zero/negative rows

Potential regression risk:
- grouping key is:
  - `lead_id` fallback + customer mobile/name/id fallback
- this is acceptable for current report behavior, but walk-in customers with inconsistent naming/mobile can fragment into multiple rows

Assessment:
- **Pass with minor reporting caveat**

---

## 5. Billing Module

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\billing.js)

Current outstanding/payment logic:
- invoice records store:
  - `grand_total`
  - `received_amount`
  - `remaining_amount`
- payment posting updates:
  - `remaining_amount = GREATEST(grand_total - received_amount, 0)`

Validation result:
- Billing module already used the canonical invoice basis before standardization
- No formula change was made here
- No regression found
- No invoice status mismatch found in ledger/report summary blocks already using `status = 'approved'`

Assessment:
- **Pass**

---

## 6. Dealer Outstanding

Source:
- `dealers.outstanding_payment`
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\owner-summary.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\dealers.js)

Validation result:
- Dealer outstanding remains separate
- It was not silently merged into dashboard summary outstanding
- In owner summary it is still explicitly separate from customer outstanding

Assessment:
- **Pass**

Important note:
- this remains a separate business concept, not part of the standardized customer invoice outstanding card

---

## 7. Project Pending Payment

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\projects.js)

Current formula:
- project revenue pending:
  - `(tiles_sales_revenue + plumbing_revenue - received_payment)`
  - clamped with `GREATEST(..., 0)`

Validation result:
- Project pending payment remains unchanged
- It is still a project-specific operational metric
- It is not incorrectly forced onto the new canonical invoice outstanding formula

Assessment:
- **Pass**

Important note:
- This means CRM still has two different valid “pending” concepts:
  - owner/customer receivable outstanding
  - project revenue pending
- this is acceptable because they are different business meanings

---

## 8. Daily Report

Source:
- [C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js](C:\Users\hp\Documents\tiles-crm\backend\src\routes\reports.js)

Validation result:
- Daily report was not changed by outstanding standardization
- It still reports:
  - sales
  - collection
  - expense
  - purchase
  - tokens
  - followups
  - cash in/out
  - net cash

No regression found.

Assessment:
- **Pass**

---

## Double Counting Check

### Customer outstanding
- now based on `invoices.remaining_amount`
- one invoice contributes once
- no quotation + invoice overlap remains in standardized endpoints

Result:
- **No double counting found in standardized endpoints**

### Dealer outstanding
- still separate in owner-summary

Result:
- **No accidental mixing found**

---

## Missing Payments Check

Billing payment flow updates:
- `received_amount`
- `remaining_amount`

Standardized endpoints now read those invoice fields directly.

Result:
- no extra payment aggregation layer was introduced in the standardized endpoints
- this reduces mismatch risk compared to old quotation/payment joins

Assessment:
- **No missing-payment regression found in the new formula path**

---

## Invoice Status Mismatch Check

Standardized endpoints now consistently use:
- `WHERE status = 'approved'`

Checked:
- dashboard summary
- customer pending report
- owner summary customer outstanding
- billing summaries already used approved invoice filters

Result:
- **No draft-vs-approved mismatch found in the standardized endpoints**

---

## Negative Outstanding Check

Current invoice payment update logic:
- `remaining_amount = GREATEST(grand_total - received_amount, 0)`

Standardized endpoints use:
- `remaining_amount`

Result:
- **No negative outstanding propagation risk found**

---

## Remaining Risks

### Risk 1: Semantic change in Leads dashboard
- `pending_collections` used to mean quotation-side pending
- now means invoice-side outstanding

Impact:
- users comparing old screenshots/reports may notice changed values

### Risk 2: Customer Pending Report grouping for walk-ins
- grouping depends on lead/customer identity fallbacks
- walk-in/manual invoices with inconsistent identity text may split rows

Impact:
- presentation/report grouping issue, not formula correctness

### Risk 3: Owner summary now mixes different categories by design
- customer outstanding = invoice-based
- dealer outstanding = dealer master field
- total outstanding = both added together

Impact:
- still valid, but UI labels must stay explicit

---

## Risk Level

**Medium**

Reason:
- formula correctness improved
- hidden technical regression risk appears low
- but semantic/reporting interpretation changed in some places, especially Leads dashboard and customer pending reporting

---

## Deployment Recommendation

**Deploy with Monitoring**

Reason:
- implementation is technically aligned and low-risk from a crash/data-integrity perspective
- but business users should verify:
  - dashboard outstanding
  - leads pending collections
  - customer pending report totals
against expected billing-ledger numbers after deployment

---

## Recommended Monitoring Checklist After Deploy

1. Compare `dashboard/summary` outstanding with Billing ledger total pending
2. Compare customer pending report totals with approved invoice remaining totals
3. Verify a partially paid approved invoice appears correctly in:
   - Billing ledger
   - Dashboard outstanding
   - Customer pending report
4. Verify draft or pending approval invoices do not affect outstanding
5. Verify project pending payment remains unchanged
6. Verify dealer outstanding remains unchanged

