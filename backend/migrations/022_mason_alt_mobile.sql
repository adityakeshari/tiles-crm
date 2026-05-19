-- 022_mason_alt_mobile.sql
-- Adds optional alternate mobile number to registered masons.

ALTER TABLE masons
  ADD COLUMN IF NOT EXISTS alt_mobile VARCHAR(20) NOT NULL DEFAULT '';
