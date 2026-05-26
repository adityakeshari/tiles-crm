-- 034_product_batch_tracking.sql
-- Preserve purchase batch / lot traceability without changing existing stock math.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS batch_no VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_purchases_product_batch_date
  ON purchases(product_id, batch_no, COALESCE(delivery_date, purchase_date) DESC);
