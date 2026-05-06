import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434'),
  user: process.env.DB_USER || 'ai',
  password: process.env.DB_PASSWORD || 'aipass',
  database: process.env.DB_NAME || 'aidb',
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contents (
        id SERIAL PRIMARY KEY,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        embedding vector(1536),
        tokens_used INTEGER NOT NULL DEFAULT 0,
        moderated BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contents_embedding 
      ON contents USING hnsw (embedding vector_cosine_ops)
    `);
  } finally {
    client.release();
  }
}

export async function resetDb() {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE contents RESTART IDENTITY');
  } finally {
    client.release();
  }
}

export { pool };
