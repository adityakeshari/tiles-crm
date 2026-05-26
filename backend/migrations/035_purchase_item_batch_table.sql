-- 035_purchase_item_batch_table.sql
-- Move batch tracking to item-level storage while preserving old purchase rows.

CREATE TABLE IF NOT EXISTS purchase_item_batches (
  purchase_id INT PRIMARY KEY REFERENCES purchases(id) ON DELETE CASCADE,
  batch_no VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_item_batches_batch_no
  ON purchase_item_batches(batch_no);

INSERT INTO purchase_item_batches (purchase_id, batch_no)
SELECT id, batch_no
FROM purchases
WHERE COALESCE(batch_no, '') <> ''
ON CONFLICT (purchase_id) DO UPDATE
SET batch_no = EXCLUDED.batch_no,
    updated_at = CURRENT_TIMESTAMP;
