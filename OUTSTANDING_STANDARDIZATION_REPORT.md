# Outstanding Standardization Report

Date: 2026-06-07

Goal:
Standardize CRM "outstanding" calculations on one canonical formula without adding new schema or APIs.

## Canonical Formula

Approved canonical formula:

`Outstanding = Approved Invoice Grand Total - Approved Invoice Payments Received`

Current implementation source of truth:

- `invoices.remaining_amount`

Reason:
- `remaining_amount` is already maintained by the billing/payment flow
- current schema does not yet model credit notes or adjustment tables separately

## Old Formula vs New Formula

### 1. `/api/dashboard/summary`

Old formula:
- quotation-based pending
- `MAX(quotation.final_amount) - SUM(payments.amount)` per lead

New formula:
- invoice-based outstanding
- `SUM(invoices.remaining_amount)` for `status = 'approved'`

### 2. `/api/leads/dashboard/stats`

Old formula:
- `pending_collections`
- quotation-based:
  - `quoted_amount - total_paid`

New formula:
- `pending_collections`
- invoice-based:
  - `SUM(invoices.remaining_amount)` for approved invoices

### 3. `/api/reports/customer-pending`

Old formula:
- latest quotation amount
- minus lead payments

New formula:
- grouped approved invoices
- billed amount = `SUM(grand_total)`
- paid amount = `SUM(received_amount)`
- pending amount = `SUM(remaining_amount)`

Compatibility note:
- `quoted_amount` key is retained as a backward-compatible alias for billed total

### 4. `/api/owner-summary`

Old formula:
- customer outstanding = quotation-based pending
- dealer outstanding = dealer manual outstanding
- total outstanding = customer + dealer

New formula:
- customer outstanding = approved invoice outstanding
- dealer outstanding unchanged
- total outstanding = invoice-based customer outstanding + dealer outstanding

## Affected Endpoints

- `GET /api/dashboard/summary`
- `GET /api/leads/dashboard/stats`
- `GET /api/reports/customer-pending`
- `GET /api/owner-summary`

## Intentionally Not Changed

### `GET /api/projects`
- `pending_payment` remains project-specific revenue pending
- this is not the generic CRM outstanding KPI

### `GET /api/billing`
- already invoice-based
- no formula change needed

### Dealer outstanding
- `dealers.outstanding_payment` remains separate
- not merged silently into generic customer outstanding

## Validation Checklist

- Dashboard summary outstanding now matches approved invoice receivable basis
- Owner dashboard outstanding card still reads from `dashboardSummary.pending_payments.amount`
- Lead dashboard `pending_collections` now aligns with invoice outstanding
- Customer pending report now lists approved invoice-based pending instead of quotation pending
- Billing ledger remains unchanged
- Project pending payment remains unchanged
- No schema changes required
- No API contract removal introduced

