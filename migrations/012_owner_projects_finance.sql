ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'manager', 'sales', 'operations', 'accounts'));

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  project_code VARCHAR(40) NOT NULL UNIQUE,
  project_name VARCHAR(140) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'on_hold', 'completed')),
  start_date DATE,
  expected_delivery_date DATE,
  completion_date DATE,
  owner_note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatches (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(140) NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  vehicle_number VARCHAR(40) NOT NULL DEFAULT '',
  driver_name VARCHAR(100) NOT NULL DEFAULT '',
  dispatch_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'delivered')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(30) NOT NULL
    CHECK (category IN ('rent', 'salary', 'transport', 'marketing', 'electricity', 'miscellaneous')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount INT NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_project_id ON dispatches(project_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status_date ON dispatches(status, dispatch_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category, expense_date);
