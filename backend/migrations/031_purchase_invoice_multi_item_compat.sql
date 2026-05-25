-- 031_purchase_invoice_multi_item_compat.sql
-- Allow one supplier invoice to contain multiple product rows while still
-- guarding against exact duplicate product rows for the same invoice date.
-- Production-safe and idempotent.

DROP INDEX IF EXISTS uq_purchases_supplier_invoice;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_supplier_invoice_product_date
  ON purchases (supplier_id, product_id, LOWER(invoice_number), purchase_date)
  WHERE supplier_id IS NOT NULL
    AND product_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND invoice_number <> '';

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_invoice_lookup
  ON purchases (supplier_id, LOWER(invoice_number), purchase_date DESC)
  WHERE supplier_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND invoice_number <> '';
