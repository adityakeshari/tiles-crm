CREATE TABLE IF NOT EXISTS masons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(15) NOT NULL UNIQUE,
  area VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE adhesive_token_claims
  ADD COLUMN IF NOT EXISTS mason_id INT REFERENCES masons(id);

INSERT INTO masons (name, mobile, area, status, created_by)
SELECT DISTINCT
  c.mason_name,
  c.mason_mobile,
  '',
  'active',
  c.created_by
FROM adhesive_token_claims c
WHERE COALESCE(TRIM(c.mason_name), '') <> ''
  AND COALESCE(TRIM(c.mason_mobile), '') <> ''
ON CONFLICT (mobile) DO NOTHING;

UPDATE adhesive_token_claims c
SET mason_id = m.id
FROM masons m
WHERE c.mason_id IS NULL
  AND m.mobile = c.mason_mobile;

ALTER TABLE adhesive_token_claims
  ALTER COLUMN mason_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'adhesive_token_claims'
      AND column_name = 'mason_mobile'
  ) THEN
    DROP INDEX IF EXISTS idx_adhesive_claims_mason_mobile;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_masons_mobile ON masons(mobile);
CREATE INDEX IF NOT EXISTS idx_masons_status ON masons(status);
CREATE INDEX IF NOT EXISTS idx_adhesive_claims_mason_id ON adhesive_token_claims(mason_id);

ALTER TABLE adhesive_token_claim_activity_logs
  DROP CONSTRAINT IF EXISTS adhesive_token_claim_activity_logs_action_check;

ALTER TABLE adhesive_token_claim_activity_logs
  ADD CONSTRAINT adhesive_token_claim_activity_logs_action_check
  CHECK (action IN ('created', 'updated', 'invoice_verified', 'mismatch_found', 'approved', 'rejected', 'reopened', 'paid'));

CREATE TABLE IF NOT EXISTS mason_activity_logs (
  id SERIAL PRIMARY KEY,
  mason_id INT REFERENCES masons(id) ON DELETE CASCADE,
  claim_id INT REFERENCES adhesive_token_claims(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL CHECK (action IN (
    'mason_registered',
    'mason_activated',
    'mason_inactivated',
    'token_claim_created',
    'blocked_inactive_mason',
    'blocked_unregistered_mason'
  )),
  note TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mason_activity_logs_mason_id ON mason_activity_logs(mason_id);
