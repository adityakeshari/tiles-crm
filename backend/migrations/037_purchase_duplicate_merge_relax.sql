-- 037_purchase_duplicate_merge_relax.sql
-- Relax strict invoice-product uniqueness so same product can exist multiple
-- times on one invoice when batch/rate/GST differ. Exact duplicates are now
-- merged safely in application logic.

DROP INDEX IF EXISTS uq_purchases_supplier_invoice_product_date;

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_invoice_product_date
  ON purchases (supplier_id, product_id, LOWER(invoice_number), purchase_date)
  WHERE supplier_id IS NOT NULL
    AND product_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND invoice_number <> '';
