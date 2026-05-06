import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'search',
  password: process.env.DB_PASSWORD || 'searchpass',
  database: process.env.DB_NAME || 'searchdb',
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        search_vector tsvector,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_search 
      ON documents USING GIN(search_vector)
    `);
    // Create a plain text index to demonstrate the missing-index bug scenario
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_content 
      ON documents(content)
    `);
  } finally {
    client.release();
  }
}

export async function resetDb() {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE documents RESTART IDENTITY');
  } finally {
    client.release();
  }
}

export { pool };
