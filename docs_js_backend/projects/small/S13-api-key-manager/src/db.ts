import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    name TEXT,
    scopes TEXT,
    rate_limit INTEGER NOT NULL DEFAULT 100,
    expires_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
`);

export default db;
