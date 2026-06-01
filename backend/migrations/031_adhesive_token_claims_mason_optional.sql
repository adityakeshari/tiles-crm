-- 031_adhesive_token_claims_mason_optional.sql
-- Legacy migration 014 declared mason_name + mason_mobile as NOT NULL.
-- Newer flows write only mason_id (FK to masons) and look the name/mobile up
-- on the fly. The INSERT in routes/schemes.js does not supply these legacy
-- columns, which throws a NOT NULL violation (PG 23502) and surfaces as a
-- 500 to the operator.
--
-- Make those two columns nullable. Production-safe: existing rows keep their
-- values, no data deleted. INSERT continues to populate them from the mason
-- master so historical reports still work.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adhesive_token_claims'
      AND column_name = 'mason_name'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE adhesive_token_claims ALTER COLUMN mason_name DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adhesive_token_claims'
      AND column_name = 'mason_mobile'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE adhesive_token_claims ALTER COLUMN mason_mobile DROP NOT NULL';
  END IF;
END$$;
