import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tenantauth:tenantauth@localhost:5432/tenantauth',
});

export async function initDb() {
  const client = await pool.connect();
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS tenant_a;
    CREATE SCHEMA IF NOT EXISTS tenant_b;

    CREATE TABLE IF NOT EXISTS tenant_a.users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tenant_b.users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  client.release();
}
