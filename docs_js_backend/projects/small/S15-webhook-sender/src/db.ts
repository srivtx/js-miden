import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'webhook',
  password: process.env.DB_PASSWORD || 'webhookpass',
  database: process.env.DB_NAME || 'webhookdb',
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        secret TEXT NOT NULL DEFAULT '',
        event_types TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_logs (
        id SERIAL PRIMARY KEY,
        webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        response_status INTEGER,
        response_body TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function resetDb() {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE delivery_logs, webhooks RESTART IDENTITY CASCADE');
  } finally {
    client.release();
  }
}

export { pool };
