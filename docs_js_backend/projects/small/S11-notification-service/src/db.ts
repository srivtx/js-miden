import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    unread_count INTEGER NOT NULL DEFAULT 0
  );
`);

export default db;
