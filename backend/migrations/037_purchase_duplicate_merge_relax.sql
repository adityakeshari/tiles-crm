-- 037_purchase_duplicate_merge_relax.sql
-- Relax strict invoice-product uniqueness so same product can exist multiple
-- times on one invoice when batch/rate/GST differ. Exact duplicates are now
-- merged safely in application logic.
--
-- Idempotent and production-safe: every statement uses IF EXISTS / IF NOT
-- EXISTS, so re-running this migration has no side effects.

-- Per-(supplier, product, invoice, date) unique index added in migration 031.
DROP INDEX IF EXISTS uq_purchases_supplier_invoice_product_date;

-- Defensive: also drop the older, stricter (supplier_name, invoice_number)
-- unique index from migration 020, in case migration 031 never ran on this
-- database. Without removing it, a single invoice cannot hold more than one
-- product row at all.
DROP INDEX IF EXISTS uq_purchases_supplier_invoice;

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_invoice_product_date
  ON purchases (supplier_id, product_id, LOWER(invoice_number), purchase_date)
  WHERE supplier_id IS NOT NULL
    AND product_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND invoice_number <> '';
