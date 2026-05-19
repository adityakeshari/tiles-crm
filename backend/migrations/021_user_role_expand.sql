-- 021_user_role_expand.sql
-- Widens the users.role CHECK constraint to include 'operator', 'token', 'inventory', 'reports'.
-- Idempotent: drops the existing constraint by exact known names; if none exists, simply re-adds the wider one.
-- Production-safe: existing data is unaffected because every existing role value remains valid.

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname
    INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'users'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%IN%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', con_name);
  END IF;
END$$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin',
    'manager',
    'sales',
    'operations',
    'accounts',
    'operator',
    'token',
    'inventory',
    'reports'
  ));
