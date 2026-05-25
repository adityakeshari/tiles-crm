ALTER TABLE products
  ADD COLUMN IF NOT EXISTS overhead_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (overhead_cost_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS final_business_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (final_business_cost_per_unit >= 0);

ALTER TABLE purchase_lots
  ADD COLUMN IF NOT EXISTS monthly_overhead_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_overhead_amount >= 0),
  ADD COLUMN IF NOT EXISTS monthly_overhead_allocation_method VARCHAR(30) NOT NULL DEFAULT 'per_box',
  ADD COLUMN IF NOT EXISTS monthly_sales_boxes NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_sales_boxes >= 0),
  ADD COLUMN IF NOT EXISTS monthly_sales_sqft NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_sales_sqft >= 0),
  ADD COLUMN IF NOT EXISTS monthly_sales_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_sales_quantity >= 0),
  ADD COLUMN IF NOT EXISTS monthly_sales_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_sales_value >= 0),
  ADD COLUMN IF NOT EXISTS monthly_overhead_rate NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (monthly_overhead_rate >= 0),
  ADD COLUMN IF NOT EXISTS total_final_business_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_final_business_cost >= 0);

ALTER TABLE purchase_lot_items
  ADD COLUMN IF NOT EXISTS allocated_monthly_overhead NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_monthly_overhead >= 0),
  ADD COLUMN IF NOT EXISTS final_business_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (final_business_cost >= 0),
  ADD COLUMN IF NOT EXISTS overhead_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (overhead_cost_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS final_business_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (final_business_cost_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS overhead_warning TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_purchase_lots_monthly_overhead_method
  ON purchase_lots(monthly_overhead_allocation_method);
