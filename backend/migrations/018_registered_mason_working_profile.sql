ALTER TABLE masons
  ADD COLUMN IF NOT EXISTS current_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_address_city VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS permanent_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS permanent_address_city VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS working_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS working_distance_upto_km INT NOT NULL DEFAULT 0;

ALTER TABLE masons
  DROP CONSTRAINT IF EXISTS masons_working_distance_upto_km_check;

ALTER TABLE masons
  ADD CONSTRAINT masons_working_distance_upto_km_check
  CHECK (working_distance_upto_km >= 0);

ALTER TABLE mason_activity_logs
  DROP CONSTRAINT IF EXISTS mason_activity_logs_action_check;

ALTER TABLE mason_activity_logs
  ADD CONSTRAINT mason_activity_logs_action_check
  CHECK (
    action IN (
      'mason_registered',
      'mason_activated',
      'mason_inactivated',
      'mason_work_profile_updated',
      'token_claim_created',
      'blocked_inactive_mason',
      'blocked_unregistered_mason'
    )
  );
