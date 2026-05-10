BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'sales', 'operations'));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS department VARCHAR(20) NOT NULL DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles';

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_department_check,
  ADD CONSTRAINT leads_department_check
  CHECK (department IN ('sales', 'operations'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_business_unit_check,
  ADD CONSTRAINT leads_business_unit_check
  CHECK (business_unit IN ('tiles', 'plumbing', 'both'));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_requirement_category_check,
  ADD CONSTRAINT leads_requirement_category_check
  CHECK (requirement_category IN ('flooring', 'bathroom', 'kitchen', 'full_house', 'plumbing'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles';

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_business_unit_check,
  ADD CONSTRAINT products_business_unit_check
  CHECK (business_unit IN ('tiles', 'plumbing', 'both'));

COMMIT;
