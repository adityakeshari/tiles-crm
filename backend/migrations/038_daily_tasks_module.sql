CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE NOT NULL,
  due_time TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'verified', 'hold')),
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_due
  ON daily_tasks(assigned_to, due_date);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_status_due
  ON daily_tasks(status, due_date);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_priority_status
  ON daily_tasks(priority, status);
