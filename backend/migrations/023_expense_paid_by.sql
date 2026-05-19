-- 023_expense_paid_by.sql
-- Adds payment mode to expenses (paid_by: cash/bank/upi/cheque/card/other).
-- Existing rows default to 'cash'. Constraint added defensively only if absent.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS paid_by VARCHAR(20) NOT NULL DEFAULT 'cash';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'expenses'::regclass
       AND conname = 'expenses_paid_by_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_paid_by_check
      CHECK (paid_by IN ('cash', 'bank', 'upi', 'cheque', 'card', 'other'));
  END IF;
END$$;
