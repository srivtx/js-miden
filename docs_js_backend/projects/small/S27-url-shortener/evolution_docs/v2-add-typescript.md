# v2-add-typescript

## Goal
Type the shortener before adding analytics and custom codes.

## Changes
1. Rename `.js` → `.ts`.
2. Introduce `UrlEntry` and `Click` types.
3. Type `pool` queries with generic row types.

## Code

```ts
// src/db.ts
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
```

```ts
// src/services/shortener.ts
export async function createShortCode(url: string, customCode?: string, expiresInDays?: number): Promise<string> {
  const shortCode = customCode || encode(++counter);
  // ...
}
```

## Decisions
- Postgres over Redis for persistence because analytics need structured querying (aggregations, date ranges).
- `initDb` runs on startup — simplifies local development.

## Risks
- `encode(++counter)` still sequential. Will fix in v6.
