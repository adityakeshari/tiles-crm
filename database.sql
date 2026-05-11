CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'manager', 'sales', 'operations', 'accounts')),
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT '',
  department VARCHAR(20) NOT NULL DEFAULT 'sales'
    CHECK (department IN ('sales', 'operations')),
  business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  customer_type VARCHAR(30) NOT NULL DEFAULT 'retail_customer'
    CHECK (customer_type IN ('retail_customer', 'contractor', 'builder', 'architect')),
  requirement_category VARCHAR(30) NOT NULL DEFAULT 'flooring'
    CHECK (requirement_category IN ('flooring', 'bathroom', 'kitchen', 'full_house', 'plumbing')),
  requirement TEXT NOT NULL DEFAULT '',
  budget INT NOT NULL DEFAULT 0 CHECK (budget >= 0),
  timeline VARCHAR(20) NOT NULL DEFAULT 'urgent'
    CHECK (timeline IN ('urgent', 'one_month', 'three_months')),
  lead_source VARCHAR(20) NOT NULL DEFAULT 'walk_in'
    CHECK (lead_source IN ('walk_in', 'reference', 'online', 'dealer')),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'interested', 'quotation_given', 'negotiation', 'converted', 'lost')),
  lost_reason TEXT NOT NULL DEFAULT '',
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE followups (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  followup_type VARCHAR(20) NOT NULL DEFAULT 'call'
    CHECK (followup_type IN ('call', 'whatsapp', 'visit', 'reminder')),
  note TEXT NOT NULL,
  followup_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE TABLE quotations (
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

CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(140) NOT NULL,
  tile_size VARCHAR(40) NOT NULL DEFAULT '',
  quantity_sqft INT NOT NULL DEFAULT 0 CHECK (quantity_sqft >= 0),
  unit_price INT NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount INT NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0),
  payment_type VARCHAR(20) NOT NULL DEFAULT 'advance'
    CHECK (payment_type IN ('advance', 'partial', 'full', 'balance')),
  due_date TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operations_tasks (
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

CREATE TABLE plumbers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  area VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE masons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(15) NOT NULL UNIQUE,
  area VARCHAR(120) NOT NULL DEFAULT '',
  current_address TEXT NOT NULL DEFAULT '',
  current_address_city VARCHAR(100) NOT NULL DEFAULT '',
  permanent_address TEXT NOT NULL DEFAULT '',
  permanent_address_city VARCHAR(100) NOT NULL DEFAULT '',
  working_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  working_distance_upto_km INT NOT NULL DEFAULT 0 CHECK (working_distance_upto_km >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE plumbing_jobs (
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

CREATE TABLE plumbing_materials (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES plumbing_jobs(id) ON DELETE CASCADE,
  item_name VARCHAR(140) NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  price INT NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
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

CREATE TABLE dispatches (
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

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(30) NOT NULL
    CHECK (category IN ('rent', 'salary', 'transport', 'marketing', 'electricity', 'miscellaneous')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount INT NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dealers (
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

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  design_code VARCHAR(60) NOT NULL DEFAULT '',
  business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  category VARCHAR(40) NOT NULL DEFAULT 'flooring',
  tile_size VARCHAR(40) NOT NULL DEFAULT '',
  finish VARCHAR(40) NOT NULL DEFAULT '',
  stock_sqft INT NOT NULL DEFAULT 0 CHECK (stock_sqft >= 0),
  price_per_sqft INT NOT NULL DEFAULT 0 CHECK (price_per_sqft >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'fast_moving', 'dead_stock')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE token_schemes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  token_value INT NOT NULL DEFAULT 0 CHECK (token_value >= 0),
  min_redemption_tokens INT NOT NULL DEFAULT 1 CHECK (min_redemption_tokens > 0),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheme_tokens (
  id SERIAL PRIMARY KEY,
  scheme_id INT NOT NULL REFERENCES token_schemes(id) ON DELETE CASCADE,
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  redeemed_lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  issued_to_name VARCHAR(100) NOT NULL,
  issued_to_phone VARCHAR(15) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL DEFAULT 'mason'
    CHECK (recipient_type IN ('mason', 'customer', 'contractor', 'dealer', 'builder')),
  token_code VARCHAR(50) NOT NULL UNIQUE,
  token_count INT NOT NULL DEFAULT 1 CHECK (token_count > 0),
  token_value INT NOT NULL DEFAULT 0 CHECK (token_value >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'redeemed', 'cancelled')),
  note TEXT NOT NULL DEFAULT '',
  issued_by INT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_by INT REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMPTZ
);

CREATE TABLE adhesive_token_claims (
  id SERIAL PRIMARY KEY,
  site_name VARCHAR(160) NOT NULL,
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number VARCHAR(120) NOT NULL,
  sale_date DATE,
  customer_name VARCHAR(120) NOT NULL,
  mason_id INT NOT NULL REFERENCES masons(id),
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
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  paid_by INT REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE adhesive_token_items (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES adhesive_token_claims(id) ON DELETE CASCADE,
  token_value INT NOT NULL CHECK (token_value >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total INT NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE adhesive_token_claim_activity_logs (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES adhesive_token_claims(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL CHECK (action IN ('created', 'updated', 'invoice_verified', 'mismatch_found', 'approved', 'rejected', 'reopened', 'paid', 'claim_created', 'claim_updated', 'claim_approved', 'claim_rejected', 'payout_paid')),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mason_activity_logs (
  id SERIAL PRIMARY KEY,
  mason_id INT REFERENCES masons(id) ON DELETE CASCADE,
  claim_id INT REFERENCES adhesive_token_claims(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL CHECK (action IN (
    'mason_registered',
    'mason_activated',
    'mason_inactivated',
    'mason_work_profile_updated',
    'token_claim_created',
    'blocked_inactive_mason',
    'blocked_unregistered_mason'
  )),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  operation_task_id INT REFERENCES operations_tasks(id) ON DELETE SET NULL,
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

CREATE TABLE app_notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link_type VARCHAR(30) NOT NULL DEFAULT 'complaint',
  link_id INT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(lead_source);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_followups_lead_id ON followups(lead_id);
CREATE INDEX idx_followups_status_date ON followups(status, followup_date);
CREATE INDEX idx_payments_lead_id ON payments(lead_id);
CREATE INDEX idx_operations_tasks_lead_id ON operations_tasks(lead_id);
CREATE INDEX idx_operations_tasks_status_date ON operations_tasks(status, scheduled_for);
CREATE INDEX idx_plumbing_jobs_lead_id ON plumbing_jobs(lead_id);
CREATE INDEX idx_plumbing_jobs_plumber_id ON plumbing_jobs(plumber_id);
CREATE INDEX idx_plumbing_jobs_status_date ON plumbing_jobs(status, scheduled_for);
CREATE INDEX idx_plumbing_materials_job_id ON plumbing_materials(job_id);
CREATE INDEX idx_masons_mobile ON masons(mobile);
CREATE INDEX idx_masons_status ON masons(status);
CREATE INDEX idx_projects_lead_id ON projects(lead_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_dispatches_project_id ON dispatches(project_id);
CREATE INDEX idx_dispatches_status_date ON dispatches(status, dispatch_date);
CREATE INDEX idx_expenses_category_date ON expenses(category, expense_date);
CREATE INDEX idx_quotations_lead_id ON quotations(lead_id);
CREATE INDEX idx_quotation_items_product_id ON quotation_items(product_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_token_schemes_active ON token_schemes(is_active);
CREATE INDEX idx_scheme_tokens_status ON scheme_tokens(status);
CREATE INDEX idx_scheme_tokens_scheme_id ON scheme_tokens(scheme_id);
CREATE INDEX idx_scheme_tokens_lead_id ON scheme_tokens(lead_id);
CREATE INDEX idx_scheme_tokens_redeemed_lead_id ON scheme_tokens(redeemed_lead_id);
CREATE INDEX idx_adhesive_claims_status ON adhesive_token_claims(status);
CREATE INDEX idx_adhesive_claims_verification_status ON adhesive_token_claims(verification_status);
CREATE INDEX idx_adhesive_claims_project_id ON adhesive_token_claims(project_id);
CREATE INDEX idx_adhesive_claims_mason_id ON adhesive_token_claims(mason_id);
CREATE INDEX idx_adhesive_claims_company ON adhesive_token_claims(adhesive_company);
CREATE INDEX idx_adhesive_claims_site_name ON adhesive_token_claims(site_name);
CREATE INDEX idx_adhesive_claims_invoice_number ON adhesive_token_claims(invoice_number);
CREATE INDEX idx_adhesive_token_items_claim_id ON adhesive_token_items(claim_id);
CREATE INDEX idx_adhesive_claim_logs_claim_id ON adhesive_token_claim_activity_logs(claim_id);
CREATE INDEX idx_mason_activity_logs_mason_id ON mason_activity_logs(mason_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_business_unit ON complaints(business_unit);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_assigned_to ON complaints(assigned_to);
CREATE INDEX idx_complaints_operation_task_id ON complaints(operation_task_id);
CREATE INDEX idx_app_notifications_user_read ON app_notifications(user_id, is_read, created_at);
