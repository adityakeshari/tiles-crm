CREATE TABLE IF NOT EXISTS app_notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link_type VARCHAR(30) NOT NULL DEFAULT 'complaint',
  link_id INT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_read
ON app_notifications(user_id, is_read, created_at);
