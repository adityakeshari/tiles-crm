ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_tasks_source_check'
  ) THEN
    ALTER TABLE daily_tasks
      ADD CONSTRAINT daily_tasks_source_check
      CHECK (source IN ('manual', 'chatgpt', 'claude', 'automation'));
  END IF;
END $$;

UPDATE daily_tasks
SET source = 'manual'
WHERE source IS NULL OR BTRIM(source) = '';
