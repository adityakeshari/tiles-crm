CREATE TABLE IF NOT EXISTS token_schemes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  business_unit VARCHAR(20) NOT NULL DEFAULT 'tiles'
    CHECK (business_unit IN ('tiles', 'plumbing', 'both')),
  token_value INT NOT NULL DEFAULT 0 CHECK (token_value >= 0),
  min_redemption_tokens INT NOT NULL DEFAULT 1 CHECK (min_redemption_tokens > 0),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheme_tokens (
  id SERIAL PRIMARY KEY,
  scheme_id INT NOT NULL REFERENCES token_schemes(id) ON DELETE CASCADE,
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  redeemed_lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  issued_to_name VARCHAR(100) NOT NULL,
  issued_to_phone VARCHAR(15) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL DEFAULT 'mason'
    CHECK (recipient_type IN ('mason', 'customer', 'contractor', 'dealer', 'builder')),
  token_code VARCHAR(50) NOT NULL UNIQUE,
  token_count INT NOT NULL DEFAULT 1 CHECK (token_count > 0),
  token_value INT NOT NULL DEFAULT 0 CHECK (token_value >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'redeemed', 'cancelled')),
  note TEXT NOT NULL DEFAULT '',
  issued_by INT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_by INT REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_token_schemes_active ON token_schemes(is_active);
CREATE INDEX IF NOT EXISTS idx_scheme_tokens_status ON scheme_tokens(status);
CREATE INDEX IF NOT EXISTS idx_scheme_tokens_scheme_id ON scheme_tokens(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_tokens_lead_id ON scheme_tokens(lead_id);
CREATE INDEX IF NOT EXISTS idx_scheme_tokens_redeemed_lead_id ON scheme_tokens(redeemed_lead_id);
