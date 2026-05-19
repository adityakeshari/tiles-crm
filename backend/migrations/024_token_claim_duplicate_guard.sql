-- 024_token_claim_duplicate_guard.sql
-- Prevents duplicate adhesive token claims for the same mason + invoice + sale date
-- (excluding rejected claims, so a previously rejected claim can be re-filed).
--
-- IMPORTANT: This index will FAIL to create if existing rows already violate the
-- uniqueness. The DO block below pre-checks for conflicts and reports them via
-- RAISE NOTICE. If conflicts exist, the index creation is skipped and the
-- application layer (routes/schemes.js) remains the only guard. Resolve the
-- conflicts (mark older duplicates as 'rejected') and re-run this migration.

DO $$
DECLARE
  conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO conflict_count FROM (
    SELECT mason_id, LOWER(invoice_number) AS inv, sale_date
      FROM adhesive_token_claims
     WHERE status <> 'rejected'
       AND invoice_number IS NOT NULL
       AND invoice_number <> ''
     GROUP BY mason_id, LOWER(invoice_number), sale_date
    HAVING COUNT(*) > 1
  ) t;

  IF conflict_count > 0 THEN
    RAISE NOTICE 'Skipping unique index creation: % duplicate (mason_id, invoice_number, sale_date) groups already exist. Resolve them (mark older rows as rejected) and re-run migration 024.', conflict_count;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_adhesive_claim_mason_invoice_date
             ON adhesive_token_claims (mason_id, LOWER(invoice_number), sale_date)
             WHERE status <> ''rejected''
               AND invoice_number IS NOT NULL
               AND invoice_number <> ''''';
  END IF;
END$$;
