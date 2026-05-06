import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5435'),
  user: process.env.DB_USER || 'jobs',
  password: process.env.DB_PASSWORD || 'jobspass',
  database: process.env.DB_NAME || 'jobsdb',
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        result JSONB,
        error TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)
    `);
  } finally {
    client.release();
  }
}

export async function resetDb() {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE jobs');
  } finally {
    client.release();
  }
}

export { pool };
