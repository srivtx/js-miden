import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://urlshort:urlshort@localhost:5432/urlshort',
});

export async function initDb() {
  const client = await pool.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS urls (
      id SERIAL PRIMARY KEY,
      short_code TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id SERIAL PRIMARY KEY,
      short_code TEXT NOT NULL,
      referrer TEXT,
      ip TEXT,
      clicked_at TIMESTAMP DEFAULT NOW()
    );
  `);
  client.release();
}
