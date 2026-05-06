import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    original_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0
  )
`);

export default db;
