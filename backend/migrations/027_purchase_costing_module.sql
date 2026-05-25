ALTER TABLE products
  ADD COLUMN IF NOT EXISTS last_purchase_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (last_purchase_rate >= 0),
  ADD COLUMN IF NOT EXISTS landed_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (landed_cost_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS minimum_allowed_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (minimum_allowed_rate >= 0),
  ADD COLUMN IF NOT EXISTS suggested_selling_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (suggested_selling_rate >= 0),
  ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS purchase_lots (
  id SERIAL PRIMARY KEY,
  lot_number VARCHAR(80) NOT NULL UNIQUE,
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number VARCHAR(40) NOT NULL DEFAULT '',
  transporter_name VARCHAR(120) NOT NULL DEFAULT '',
  driver_name VARCHAR(120) NOT NULL DEFAULT '',
  driver_mobile VARCHAR(20) NOT NULL DEFAULT '',
  allocation_method VARCHAR(20) NOT NULL DEFAULT 'by_value'
    CHECK (allocation_method IN ('by_value', 'by_quantity', 'manual')),
  total_freight_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_freight_cost >= 0),
  total_unloading_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_unloading_cost >= 0),
  other_charges NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_charges >= 0),
  financed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (financed_amount >= 0),
  interest_rate_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (interest_rate_percent >= 0),
  holding_days NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (holding_days >= 0),
  interest_cost_override NUMERIC(14, 2),
  interest_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (interest_cost >= 0),
  showroom_overhead_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (showroom_overhead_amount >= 0),
  overhead_period VARCHAR(60) NOT NULL DEFAULT '',
  overhead_notes TEXT NOT NULL DEFAULT '',
  minimum_margin_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (minimum_margin_percent >= 0),
  target_margin_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (target_margin_percent >= 0),
  total_purchase_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_purchase_value >= 0),
  total_net_usable_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_net_usable_quantity >= 0),
  remarks TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'cost_calculated', 'approved', 'cancelled')),
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  cancelled_by INT REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lot_suppliers (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  supplier_name VARCHAR(140) NOT NULL,
  supplier_invoice_number VARCHAR(80) NOT NULL DEFAULT '',
  supplier_invoice_date DATE,
  supplier_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (supplier_amount >= 0),
  supplier_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lot_items (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  supplier_id INT NOT NULL REFERENCES purchase_lot_suppliers(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'tiles',
  quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  basic_purchase_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (basic_purchase_rate >= 0),
  purchase_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_value >= 0),
  damage_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (damage_quantity >= 0),
  damage_decay_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (damage_decay_percent >= 0),
  net_usable_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (net_usable_quantity >= 0),
  allocated_freight NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_freight >= 0),
  allocated_unloading NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_unloading >= 0),
  allocated_interest NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_interest >= 0),
  allocated_showroom_overhead NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_showroom_overhead >= 0),
  allocated_other_charges NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (allocated_other_charges >= 0),
  final_landed_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (final_landed_cost >= 0),
  landed_cost_per_unit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (landed_cost_per_unit >= 0),
  minimum_allowed_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (minimum_allowed_rate >= 0),
  suggested_selling_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (suggested_selling_rate >= 0),
  manual_allocation_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (manual_allocation_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lot_charges (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  charge_type VARCHAR(30) NOT NULL
    CHECK (charge_type IN ('freight', 'unloading', 'interest', 'overhead', 'other')),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lot_activity_logs (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL REFERENCES purchase_lots(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL
    CHECK (action IN ('created', 'updated', 'cost_calculated', 'approved', 'cancelled', 'inventory_resynced')),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_cost_updated_at ON products(cost_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_status ON purchase_lots(status);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_arrival_date ON purchase_lots(arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_created_at ON purchase_lots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_lot_suppliers_supplier_name ON purchase_lot_suppliers(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchase_lot_items_product_id ON purchase_lot_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lot_items_created_at ON purchase_lot_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_lot_items_supplier_id ON purchase_lot_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lot_activity_logs_lot_id ON purchase_lot_activity_logs(lot_id);
