ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS truck_number VARCHAR(120) NOT NULL DEFAULT '';

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

CREATE INDEX IF NOT EXISTS idx_purchases_truck_delivery
  ON purchases (truck_number, delivery_date DESC, purchase_date DESC);
