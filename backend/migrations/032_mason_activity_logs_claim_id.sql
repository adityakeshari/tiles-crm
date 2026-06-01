-- 032_mason_activity_logs_claim_id.sql
-- Bug surfaced via PM2 log:
--   [adhesive-claim-insert] code=42703
--   message=column "claim_id" of relation "mason_activity_logs" does not exist
--
-- Root cause: routes/schemes.js -> logMasonActivity() INSERTs
--   (mason_id, claim_id, action, note, created_by)
-- but mason_activity_logs (declared in migration 017) only has
--   (id, mason_id, action, note, details, created_by, created_at).
--
-- The code intentionally enriches the mason audit trail with the claim id
-- (8 call sites in schemes.js). The sibling adhesive_token_claim_activity_logs
-- table already carries claim_id, so the pattern is consistent.
--
-- This migration ADDS the missing column. Existing rows get NULL (their
-- historical audit context is preserved in the `note` text). Production-safe,
-- idempotent: ADD COLUMN IF NOT EXISTS. No data deleted.

ALTER TABLE mason_activity_logs
  ADD COLUMN IF NOT EXISTS claim_id INTEGER REFERENCES adhesive_token_claims(id) ON DELETE SET NULL;

-- Helpful index for "show all mason activity for this claim" lookups.
CREATE INDEX IF NOT EXISTS idx_mason_activity_logs_claim_id
  ON mason_activity_logs(claim_id);
