ALTER TABLE users
  ADD COLUMN IF NOT EXISTS roles TEXT[];

UPDATE users
SET roles = ARRAY[role]
WHERE (roles IS NULL OR cardinality(roles) = 0)
  AND role IS NOT NULL
  AND role <> '';

UPDATE users
SET roles = ARRAY['admin', 'sales', 'operations', 'accounts', 'inventory', 'token', 'reports'],
    role = 'admin'
WHERE phone = '9406776027';

ALTER TABLE users
  ALTER COLUMN roles SET DEFAULT ARRAY[]::TEXT[];
