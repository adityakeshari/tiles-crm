BEGIN;

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  design_code VARCHAR(60) NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'flooring',
  tile_size VARCHAR(40) NOT NULL DEFAULT '',
  finish VARCHAR(40) NOT NULL DEFAULT '',
  stock_sqft INT NOT NULL DEFAULT 0 CHECK (stock_sqft >= 0),
  price_per_sqft INT NOT NULL DEFAULT 0 CHECK (price_per_sqft >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'fast_moving', 'dead_stock')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

COMMIT;
