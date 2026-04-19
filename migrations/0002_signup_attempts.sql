CREATE TABLE IF NOT EXISTS signup_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_at ON signup_attempts(ip_hash, at);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_at ON signup_attempts(at);
