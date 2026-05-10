CREATE TABLE IF NOT EXISTS adhesive_token_entries (
  id SERIAL PRIMARY KEY,
  site_name VARCHAR(160) NOT NULL,
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  mason_name VARCHAR(120) NOT NULL,
  mason_mobile VARCHAR(15) NOT NULL,
  adhesive_company VARCHAR(120) NOT NULL,
  adhesive_type VARCHAR(120) NOT NULL,
  bag_quantity INT NOT NULL CHECK (bag_quantity > 0),
  token_value_per_bag INT NOT NULL CHECK (token_value_per_bag >= 0),
  total_token_amount INT NOT NULL CHECK (total_token_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected')),
  payment_date DATE,
  remarks TEXT NOT NULL DEFAULT '',
  token_photo_url TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adhesive_token_activity_logs (
  id SERIAL PRIMARY KEY,
  token_entry_id INT NOT NULL REFERENCES adhesive_token_entries(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'paid', 'rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adhesive_tokens_status ON adhesive_token_entries(status);
CREATE INDEX IF NOT EXISTS idx_adhesive_tokens_project_id ON adhesive_token_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_adhesive_tokens_mason_mobile ON adhesive_token_entries(mason_mobile);
CREATE INDEX IF NOT EXISTS idx_adhesive_tokens_company ON adhesive_token_entries(adhesive_company);
CREATE INDEX IF NOT EXISTS idx_adhesive_tokens_site_name ON adhesive_token_entries(site_name);
CREATE INDEX IF NOT EXISTS idx_adhesive_token_logs_entry_id ON adhesive_token_activity_logs(token_entry_id);
