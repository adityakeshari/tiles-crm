ALTER TABLE adhesive_token_claims
  ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE adhesive_token_claim_activity_logs
  DROP CONSTRAINT IF EXISTS adhesive_token_claim_activity_logs_action_check;

ALTER TABLE adhesive_token_claim_activity_logs
  ADD CONSTRAINT adhesive_token_claim_activity_logs_action_check
  CHECK (
    action IN (
      'created',
      'updated',
      'invoice_verified',
      'mismatch_found',
      'approved',
      'rejected',
      'reopened',
      'paid',
      'claim_created',
      'claim_updated',
      'claim_approved',
      'claim_rejected',
      'payout_paid'
    )
  );
