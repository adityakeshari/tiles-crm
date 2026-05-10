ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS operation_task_id INT REFERENCES operations_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_operation_task_id
ON complaints(operation_task_id);
