ALTER TABLE products
  ADD COLUMN IF NOT EXISTS predefined_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (predefined_rate >= 0),
  ADD COLUMN IF NOT EXISTS today_selling_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (today_selling_rate >= 0),
  ADD COLUMN IF NOT EXISTS daily_up_limit_percent NUMERIC(8, 2) NOT NULL DEFAULT 2 CHECK (daily_up_limit_percent >= 0),
  ADD COLUMN IF NOT EXISTS daily_down_limit_percent NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (daily_down_limit_percent >= 0),
  ADD COLUMN IF NOT EXISTS operator_discount_cap NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (operator_discount_cap >= 0),
  ADD COLUMN IF NOT EXISTS manager_discount_cap NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (manager_discount_cap >= 0),
  ADD COLUMN IF NOT EXISTS owner_discount_cap NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (owner_discount_cap >= 0),
  ADD COLUMN IF NOT EXISTS quotation_validity_days INT NOT NULL DEFAULT 0 CHECK (quotation_validity_days >= 0);

UPDATE products
SET predefined_rate = COALESCE(NULLIF(predefined_rate, 0), NULLIF(suggested_selling_rate, 0), NULLIF(price_per_sqft, 0), NULLIF(minimum_allowed_rate, 0), 0)
WHERE COALESCE(predefined_rate, 0) = 0;

UPDATE products
SET today_selling_rate = COALESCE(NULLIF(today_selling_rate, 0), NULLIF(predefined_rate, 0), NULLIF(suggested_selling_rate, 0), NULLIF(price_per_sqft, 0), 0)
WHERE COALESCE(today_selling_rate, 0) = 0;
