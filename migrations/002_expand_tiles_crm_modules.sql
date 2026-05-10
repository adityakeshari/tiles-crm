BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS location VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(30) NOT NULL DEFAULT 'retail_customer',
  ADD COLUMN IF NOT EXISTS requirement_category VARCHAR(30) NOT NULL DEFAULT 'flooring',
  ADD COLUMN IF NOT EXISTS timeline VARCHAR(20) NOT NULL DEFAULT 'urgent',
  ADD COLUMN IF NOT EXISTS lead_source VARCHAR(20) NOT NULL DEFAULT 'walk_in',
  ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_to INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_check,
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'interested', 'quotation_given', 'negotiation', 'converted', 'lost'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_customer_type_check,
  ADD CONSTRAINT leads_customer_type_check
  CHECK (customer_type IN ('retail_customer', 'contractor', 'builder', 'architect'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_requirement_category_check,
  ADD CONSTRAINT leads_requirement_category_check
  CHECK (requirement_category IN ('flooring', 'bathroom', 'kitchen', 'full_house'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_timeline_check,
  ADD CONSTRAINT leads_timeline_check
  CHECK (timeline IN ('urgent', 'one_month', 'three_months'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_lead_source_check,
  ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source IN ('walk_in', 'reference', 'online', 'dealer'));

ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS followup_type VARCHAR(20) NOT NULL DEFAULT 'call',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE followups
  DROP CONSTRAINT IF EXISTS followups_followup_type_check,
  ADD CONSTRAINT followups_followup_type_check
  CHECK (followup_type IN ('call', 'whatsapp', 'visit', 'reminder'));

ALTER TABLE followups
  DROP CONSTRAINT IF EXISTS followups_status_check,
  ADD CONSTRAINT followups_status_check
  CHECK (status IN ('pending', 'completed', 'overdue'));

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'advance',
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check,
  ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('advance', 'partial', 'full', 'balance'));

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  subtotal INT NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount INT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  transport_cost INT NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  final_amount INT NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'shared', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_name VARCHAR(140) NOT NULL,
  tile_size VARCHAR(40) NOT NULL DEFAULT '',
  quantity_sqft INT NOT NULL DEFAULT 0 CHECK (quantity_sqft >= 0),
  unit_price INT NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount INT NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS dealers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  area VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(15) NOT NULL DEFAULT '',
  monthly_purchase INT NOT NULL DEFAULT 0 CHECK (monthly_purchase >= 0),
  credit_limit INT NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  outstanding_payment INT NOT NULL DEFAULT 0 CHECK (outstanding_payment >= 0),
  commission_percent INT NOT NULL DEFAULT 0 CHECK (commission_percent >= 0),
  category VARCHAR(1) NOT NULL DEFAULT 'C' CHECK (category IN ('A', 'B', 'C')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_lead_id ON followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_status_date ON followups(status, followup_date);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON quotations(lead_id);

COMMIT;
