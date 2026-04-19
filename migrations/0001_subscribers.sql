CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL,
  zip_code TEXT,
  place_name TEXT,
  state_code TEXT,
  latitude REAL,
  longitude REAL,
  sunset_mode TEXT NOT NULL DEFAULT 'precise' CHECK (sunset_mode IN ('estimated', 'precise', 'zip')),
  reminder_offset_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed', 'suppressed')),
  confirm_token TEXT,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_sent_local_date TEXT,
  last_sent_omer_day INTEGER,
  last_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm_token ON subscribers(confirm_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token ON subscribers(unsubscribe_token);
