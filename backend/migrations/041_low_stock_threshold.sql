ALTER TABLE products
ADD COLUMN IF NOT EXISTS low_stock_threshold INT;

UPDATE products
SET low_stock_threshold = 10
WHERE low_stock_threshold IS NULL
   OR low_stock_threshold < 0;

ALTER TABLE products
ALTER COLUMN low_stock_threshold SET DEFAULT 10;

ALTER TABLE products
ALTER COLUMN low_stock_threshold SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_low_stock_threshold_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_low_stock_threshold_check
    CHECK (low_stock_threshold >= 0);
  END IF;
END $$;
