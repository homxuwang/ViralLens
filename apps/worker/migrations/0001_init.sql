PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, credits INTEGER NOT NULL DEFAULT 0 CHECK(credits >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE subscriptions (user_id TEXT PRIMARY KEY REFERENCES users(id), status TEXT NOT NULL DEFAULT 'none', plan TEXT NOT NULL DEFAULT 'free', expires_at TEXT);
CREATE TABLE usage_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), task TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX usage_user_time ON usage_records(user_id,created_at);
CREATE TABLE payment_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
