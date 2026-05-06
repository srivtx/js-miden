import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    salary_min REAL NOT NULL,
    salary_max REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('full-time', 'contract')),
    remote INTEGER NOT NULL DEFAULT 0,
    posted_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Intentionally missing indexes on filter/sort fields for the bug

export default db;
