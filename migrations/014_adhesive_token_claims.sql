ALTER TABLE IF EXISTS adhesive_token_activity_logs RENAME TO adhesive_token_activity_logs_legacy;
ALTER TABLE IF EXISTS adhesive_token_entries RENAME TO adhesive_token_entries_legacy;

CREATE TABLE IF NOT EXISTS adhesive_token_claims (
  id SERIAL PRIMARY KEY,
  site_name VARCHAR(160) NOT NULL,
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number VARCHAR(120) NOT NULL,
  sale_date DATE,
  customer_name VARCHAR(120) NOT NULL,
  mason_name VARCHAR(120) NOT NULL,
  mason_mobile VARCHAR(15) NOT NULL,
  adhesive_company VARCHAR(120) NOT NULL,
  adhesive_type VARCHAR(120) NOT NULL,
  sold_bag_quantity INT NOT NULL CHECK (sold_bag_quantity > 0),
  claimed_bag_quantity INT NOT NULL DEFAULT 0 CHECK (claimed_bag_quantity >= 0),
  total_token_amount INT NOT NULL DEFAULT 0 CHECK (total_token_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected')),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'matched', 'mismatch', 'approved', 'rejected')),
  payment_date DATE,
  remarks TEXT NOT NULL DEFAULT '',
  token_photo_url TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adhesive_token_items (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES adhesive_token_claims(id) ON DELETE CASCADE,
  token_value INT NOT NULL CHECK (token_value >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total INT NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS adhesive_token_claim_activity_logs (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES adhesive_token_claims(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL CHECK (action IN ('created', 'invoice_verified', 'mismatch_found', 'approved', 'rejected', 'paid')),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO adhesive_token_claims (
  site_name,
  project_id,
  invoice_number,
  sale_date,
  customer_name,
  mason_name,
  mason_mobile,
  adhesive_company,
  adhesive_type,
  sold_bag_quantity,
  claimed_bag_quantity,
  total_token_amount,
  status,
  verification_status,
  payment_date,
  remarks,
  token_photo_url,
  created_by,
  verified_by,
  verified_at,
  created_at
)
SELECT
  e.site_name,
  e.project_id,
  CONCAT('LEGACY-', e.id),
  e.created_at::date,
  COALESCE(l.name, 'Legacy Customer'),
  e.mason_name,
  e.mason_mobile,
  e.adhesive_company,
  e.adhesive_type,
  e.bag_quantity,
  e.bag_quantity,
  e.total_token_amount,
  e.status,
  CASE
    WHEN e.status = 'paid' THEN 'approved'
    WHEN e.status = 'rejected' THEN 'rejected'
    ELSE 'unverified'
  END,
  e.payment_date,
  e.remarks,
  e.token_photo_url,
  e.created_by,
  CASE WHEN e.status = 'paid' THEN e.created_by ELSE NULL END,
  CASE WHEN e.status = 'paid' THEN e.created_at ELSE NULL END,
  e.created_at
FROM adhesive_token_entries_legacy e
LEFT JOIN projects p ON p.id = e.project_id
LEFT JOIN leads l ON l.id = p.lead_id
WHERE NOT EXISTS (
  SELECT 1
  FROM adhesive_token_claims c
  WHERE c.invoice_number = CONCAT('LEGACY-', e.id)
);

INSERT INTO adhesive_token_items (claim_id, token_value, quantity, line_total)
SELECT
  c.id,
  CASE
    WHEN e.bag_quantity > 0 THEN e.total_token_amount / e.bag_quantity
    ELSE 0
  END,
  e.bag_quantity,
  e.total_token_amount
FROM adhesive_token_entries_legacy e
JOIN adhesive_token_claims c ON c.invoice_number = CONCAT('LEGACY-', e.id)
WHERE NOT EXISTS (
  SELECT 1
  FROM adhesive_token_items i
  WHERE i.claim_id = c.id
);

INSERT INTO adhesive_token_claim_activity_logs (claim_id, action, note, created_by, created_at)
SELECT
  c.id,
  CASE
    WHEN l.action = 'created' THEN 'created'
    WHEN l.action = 'paid' THEN 'paid'
    WHEN l.action = 'rejected' THEN 'rejected'
    ELSE 'created'
  END,
  l.note,
  l.created_by,
  l.created_at
FROM adhesive_token_activity_logs_legacy l
JOIN adhesive_token_claims c ON c.invoice_number = CONCAT('LEGACY-', l.token_entry_id);

CREATE INDEX IF NOT EXISTS idx_adhesive_claims_status ON adhesive_token_claims(status);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_verification_status ON adhesive_token_claims(verification_status);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_project_id ON adhesive_token_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_mason_mobile ON adhesive_token_claims(mason_mobile);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_company ON adhesive_token_claims(adhesive_company);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_site_name ON adhesive_token_claims(site_name);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_invoice_number ON adhesive_token_claims(invoice_number);
CREATE INDEX IF NOT EXISTS idx_adhesive_token_items_claim_id ON adhesive_token_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_adhesive_claim_logs_claim_id ON adhesive_token_claim_activity_logs(claim_id);
