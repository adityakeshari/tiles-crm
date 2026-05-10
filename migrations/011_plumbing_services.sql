CREATE TABLE IF NOT EXISTS plumbers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  area VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plumbing_jobs (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  plumber_id INT REFERENCES plumbers(id) ON DELETE SET NULL,
  work_type VARCHAR(30) NOT NULL DEFAULT 'bathroom'
    CHECK (work_type IN ('bathroom', 'kitchen', 'pipeline', 'fitting', 'repair', 'full_plumbing')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ongoing', 'completed', 'on_hold')),
  service_charge INT NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  scheduled_for TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plumbing_materials (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES plumbing_jobs(id) ON DELETE CASCADE,
  item_name VARCHAR(140) NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  price INT NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plumbing_jobs_lead_id ON plumbing_jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_plumbing_jobs_plumber_id ON plumbing_jobs(plumber_id);
CREATE INDEX IF NOT EXISTS idx_plumbing_jobs_status_date ON plumbing_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_plumbing_materials_job_id ON plumbing_materials(job_id);
