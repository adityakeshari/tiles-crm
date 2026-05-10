BEGIN;

ALTER TABLE users
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'sales',
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN password SET NOT NULL;

ALTER TABLE leads
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN budget SET DEFAULT 0,
  ALTER COLUMN budget SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'new',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE followups
  ALTER COLUMN lead_id SET NOT NULL,
  ALTER COLUMN note SET NOT NULL,
  ALTER COLUMN followup_date TYPE TIMESTAMPTZ
  USING followup_date AT TIME ZONE 'Asia/Calcutta';

ALTER TABLE payments
  ALTER COLUMN lead_id SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'manager', 'sales'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_budget_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_budget_check
      CHECK (budget >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_status_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_status_check
      CHECK (status IN ('new', 'qualified', 'negotiation', 'won', 'lost'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_amount_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_amount_check
      CHECK (amount > 0);
  END IF;
END $$;

ALTER TABLE followups
  DROP CONSTRAINT IF EXISTS followups_lead_id_fkey,
  ADD CONSTRAINT followups_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_lead_id_fkey,
  ADD CONSTRAINT payments_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

COMMIT;
