BEGIN;

CREATE TABLE IF NOT EXISTS operations_tasks (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  task_type VARCHAR(20) NOT NULL DEFAULT 'delivery'
    CHECK (task_type IN ('delivery', 'site_visit', 'installation', 'measurement')),
  title VARCHAR(140) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  scheduled_for TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operations_tasks_lead_id ON operations_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_operations_tasks_status_date ON operations_tasks(status, scheduled_for);

COMMIT;
