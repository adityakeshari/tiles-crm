-- 020_purchase_entries.sql
-- Adds the purchase entry module for showroom operators (e.g. Poonam).
-- Production-safe: uses IF NOT EXISTS throughout. No destructive operations.

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  supplier_name VARCHAR(150) NOT NULL,
  supplier_phone VARCHAR(20) NOT NULL DEFAULT '',
  invoice_number VARCHAR(120) NOT NULL DEFAULT '',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  category VARCHAR(60) NOT NULL DEFAULT 'tiles',
  item_name VARCHAR(200) NOT NULL DEFAULT '',
  quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  gst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  remarks TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_date_desc
  ON purchases(purchase_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_name
  ON purchases(supplier_name);

CREATE INDEX IF NOT EXISTS idx_purchases_payment_status_date
  ON purchases(payment_status, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_business_unit_date
  ON purchases(business_unit, purchase_date DESC);

-- Soft duplicate guard: same supplier + invoice should not be entered twice.
-- Uses partial index so blank invoice numbers (legacy / draft entries) are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_supplier_invoice
  ON purchases (LOWER(supplier_name), LOWER(invoice_number))
  WHERE invoice_number IS NOT NULL AND invoice_number <> '';
