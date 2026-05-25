-- 026_billing_module.sql
-- Independent billing module for showroom billing, approvals, payments, and stock-aware invoices.

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  invoice_type VARCHAR(20) NOT NULL DEFAULT 'gst_invoice'
    CHECK (invoice_type IN ('gst_invoice', 'estimate')),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name VARCHAR(120) NOT NULL,
  customer_mobile VARCHAR(20) NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  site_reference VARCHAR(160) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'mixed')),
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
  gst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  transport_charge NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (transport_charge >= 0),
  additional_charge NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (additional_charge >= 0),
  grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  received_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  approval_reason TEXT NOT NULL DEFAULT '',
  approval_note TEXT NOT NULL DEFAULT '',
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  cancelled_by INT REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  item_type VARCHAR(30) NOT NULL DEFAULT 'tiles'
    CHECK (item_type IN ('tiles', 'plumbing', 'adhesive', 'granite_marble', 'custom_item')),
  product_name VARCHAR(160) NOT NULL,
  quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  gst_percent NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (gst_percent >= 0),
  total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'mixed')),
  note TEXT NOT NULL DEFAULT '',
  received_by INT REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_activity_logs (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL
    CHECK (action IN ('created', 'updated', 'submitted_for_approval', 'approved', 'rejected', 'cancelled', 'payment_recorded', 'deleted', 'stock_reduced', 'stock_restored', 'printed', 'shared')),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_date_desc
  ON invoices(invoice_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status_date
  ON invoices(status, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status_date
  ON invoices(payment_status, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_mobile
  ON invoices(customer_mobile);

CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON invoices(project_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id
  ON invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id
  ON invoice_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_received_at
  ON invoice_payments(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_activity_logs_invoice_id
  ON invoice_activity_logs(invoice_id);
