-- 025_purchases_and_dashboard_indexes.sql
-- Index pack supporting purchases listing, dashboard summary aggregates, and daily report.

CREATE INDEX IF NOT EXISTS idx_purchases_created_by_date
  ON purchases(created_by, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_created_at_desc
  ON purchases(created_at DESC);

-- Used by collection/payment dashboard slices.
CREATE INDEX IF NOT EXISTS idx_payments_lead_created_at
  ON payments(lead_id, created_at DESC);

-- Used by daily report aggregation by date.
CREATE INDEX IF NOT EXISTS idx_expenses_created_at_desc
  ON expenses(created_at DESC);
