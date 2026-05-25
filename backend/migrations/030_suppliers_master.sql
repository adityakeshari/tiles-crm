-- 030_suppliers_master.sql
-- Supplier master + FK columns on purchases so Purchase Entry can require a
-- registered supplier and a registered inventory product.
-- Production-safe: old purchases keep working (supplier_id / product_id NULLABLE).

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL DEFAULT '',
  alt_mobile VARCHAR(20) NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  gstin VARCHAR(20) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  category VARCHAR(60) NOT NULL DEFAULT 'general',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  remarks TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Soft duplicate guard on (LOWER(name), mobile)
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_name_mobile
  ON suppliers (LOWER(name), mobile)
  WHERE name <> '';

CREATE INDEX IF NOT EXISTS idx_suppliers_status_name
  ON suppliers(status, name);

CREATE INDEX IF NOT EXISTS idx_suppliers_city
  ON suppliers(city);

-- Add FK columns to purchases (nullable so legacy rows remain valid)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id
  ON purchases(supplier_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_product_id
  ON purchases(product_id, purchase_date DESC);
