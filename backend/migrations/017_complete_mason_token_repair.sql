-- 017_complete_mason_token_repair.sql
-- Safe repair migration for Registered Mason + Adhesive Token workflow
-- Safe to run multiple times. Does not delete data.

BEGIN;

-- =========================
-- 1) Masons master table
-- =========================
CREATE TABLE IF NOT EXISTS masons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  area VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  remarks TEXT,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  registered_by INTEGER REFERENCES users(id)
);

ALTER TABLE masons ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE masons ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
ALTER TABLE masons ADD COLUMN IF NOT EXISTS area VARCHAR(150);
ALTER TABLE masons ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE masons ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE masons ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE masons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE masons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE masons ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE masons ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE masons ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id);

UPDATE masons SET status = 'active' WHERE status IS NULL;
UPDATE masons SET registered_at = created_at WHERE registered_at IS NULL AND created_at IS NOT NULL;
UPDATE masons SET registered_at = CURRENT_TIMESTAMP WHERE registered_at IS NULL;
UPDATE masons SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE masons SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

-- =========================
-- 2) Mason activity logs
-- =========================
CREATE TABLE IF NOT EXISTS mason_activity_logs (
  id SERIAL PRIMARY KEY,
  mason_id INTEGER REFERENCES masons(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  note TEXT,
  details TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS mason_id INTEGER REFERENCES masons(id) ON DELETE CASCADE;
ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);
ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE mason_activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =========================
-- 3) Adhesive token claim repair
-- =========================
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS mason_id INTEGER REFERENCES masons(id);
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS mason_area VARCHAR(150);
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id);
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS paid_by INTEGER REFERENCES users(id);
ALTER TABLE adhesive_token_claims ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Keep old data readable if mason_mobile/mason_name already exists
-- No destructive changes.

-- =========================
-- 4) Adhesive token activity log repair
-- =========================
CREATE TABLE IF NOT EXISTS adhesive_token_claim_activity_logs (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER REFERENCES adhesive_token_claims(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  note TEXT,
  details TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES adhesive_token_claims(id) ON DELETE CASCADE;
ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);
ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE adhesive_token_claim_activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =========================
-- 5) Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_masons_mobile ON masons(mobile);
CREATE INDEX IF NOT EXISTS idx_masons_status ON masons(status);
CREATE INDEX IF NOT EXISTS idx_masons_created_by ON masons(created_by);
CREATE INDEX IF NOT EXISTS idx_mason_activity_logs_mason_id ON mason_activity_logs(mason_id);
CREATE INDEX IF NOT EXISTS idx_mason_activity_logs_created_by ON mason_activity_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_adhesive_token_claims_mason_id ON adhesive_token_claims(mason_id);
CREATE INDEX IF NOT EXISTS idx_adhesive_claim_logs_claim_id ON adhesive_token_claim_activity_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_adhesive_claim_logs_created_by ON adhesive_token_claim_activity_logs(created_by);

COMMIT;