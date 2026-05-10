CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT '',
  business_unit VARCHAR(20) NOT NULL DEFAULT 'plumbing'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'leakage', 'blockage', 'pressure_issue', 'fitting_issue', 'installation_defect',
      'tile_breakage', 'shade_mismatch', 'delivery_damage', 'service_delay', 'other'
    )),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  title VARCHAR(140) NOT NULL,
  description TEXT NOT NULL,
  resolution_note TEXT NOT NULL DEFAULT '',
  due_date TIMESTAMPTZ,
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_business_unit ON complaints(business_unit);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);
