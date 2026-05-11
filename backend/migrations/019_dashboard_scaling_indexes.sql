CREATE INDEX IF NOT EXISTS idx_leads_created_at_desc
  ON leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_department_status_created_at
  ON leads(department, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_business_unit_created_at
  ON leads(business_unit, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_created_at_desc
  ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_created_at_desc
  ON quotations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_created_at_desc
  ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_status_created_at
  ON projects(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_date_desc
  ON expenses(expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adhesive_claims_created_at_desc
  ON adhesive_token_claims(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adhesive_claims_status_created_at
  ON adhesive_token_claims(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adhesive_claims_mason_status_created_at
  ON adhesive_token_claims(mason_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_masons_status_current_city
  ON masons(status, current_address_city);

CREATE INDEX IF NOT EXISTS idx_complaints_priority_created_at
  ON complaints(priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_followups_lead_status_date
  ON followups(lead_id, status, followup_date DESC);
