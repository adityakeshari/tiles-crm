BEGIN;

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotation_items_product_id ON quotation_items(product_id);

COMMIT;
