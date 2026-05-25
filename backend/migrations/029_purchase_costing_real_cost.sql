ALTER TABLE products
  ADD COLUMN IF NOT EXISTS real_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (real_cost_per_unit >= 0);

ALTER TABLE purchase_lots
  ADD COLUMN IF NOT EXISTS stock_received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS calculated_interest_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (calculated_interest_cost >= 0),
  ADD COLUMN IF NOT EXISTS time_decay_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (time_decay_percent >= 0),
  ADD COLUMN IF NOT EXISTS time_decay_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (time_decay_cost >= 0),
  ADD COLUMN IF NOT EXISTS marketing_cost_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (marketing_cost_amount >= 0),
  ADD COLUMN IF NOT EXISTS marketing_cost_allocation_method VARCHAR(30) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS total_truck_weight_kg NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_truck_weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS freight_per_kg NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (freight_per_kg >= 0),
  ADD COLUMN IF NOT EXISTS total_real_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_real_cost >= 0);

ALTER TABLE purchase_lot_items
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(140) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_size VARCHAR(60) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS boxes NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (boxes >= 0),
  ADD COLUMN IF NOT EXISTS pieces_per_box NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (pieces_per_box >= 0),
  ADD COLUMN IF NOT EXISTS sqft_per_box NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sqft_per_box >= 0),
  ADD COLUMN IF NOT EXISTS weight_per_box NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (weight_per_box >= 0),
  ADD COLUMN IF NOT EXISTS weight_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (weight_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS allocated_time_decay NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_time_decay >= 0),
  ADD COLUMN IF NOT EXISTS allocated_marketing_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_marketing_cost >= 0),
  ADD COLUMN IF NOT EXISTS real_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (real_cost >= 0),
  ADD COLUMN IF NOT EXISTS real_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (real_cost_per_unit >= 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_lots_allocation_method_check'
  ) THEN
    ALTER TABLE purchase_lots DROP CONSTRAINT purchase_lots_allocation_method_check;
  END IF;
END $$;

ALTER TABLE purchase_lots
  ADD CONSTRAINT purchase_lots_allocation_method_check
  CHECK (allocation_method IN ('weight_wise', 'purchase_value_wise', 'quantity_wise', 'supplier_amount_wise', 'manual', 'by_value', 'by_quantity'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_lot_charges_charge_type_check'
  ) THEN
    ALTER TABLE purchase_lot_charges DROP CONSTRAINT purchase_lot_charges_charge_type_check;
  END IF;
END $$;

ALTER TABLE purchase_lot_charges
  ADD CONSTRAINT purchase_lot_charges_charge_type_check
  CHECK (charge_type IN ('freight', 'unloading', 'interest', 'overhead', 'time_decay', 'marketing', 'other'));
