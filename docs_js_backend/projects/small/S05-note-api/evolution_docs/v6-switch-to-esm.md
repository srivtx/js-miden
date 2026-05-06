# v6 — Switch to ESM (Note API)

## The Scenario

It's 2am. Your junior wants to use `postgres` (the new ESM-only driver) instead of `pg`. "It's faster and has better TypeScript support," they say. They install it. They try to `require('postgres')`. `ERR_REQUIRE_ESM`. They look at their CommonJS project and cry.

## The PAIN: Database Drivers Are Diversifying

From v5:

```typescript
// Using pg (CommonJS-compatible)
import { Pool } from 'pg';

// But newer drivers:
import postgres from 'postgres'; // ESM-only. Would fail in CJS project.
```

The JavaScript database ecosystem is fragmenting by module system. Being stuck in CommonJS limits your options.

## The Solution: ESM for Database Access

### 1. package.json

```json
{
  "name": "s05-note-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:up": "docker compose up -d"
  }
}
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 3. Source files

```typescript
// src/index.ts
import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', router);

const PORT = process.env.PORT || 3000;
export const server = app.listen(PORT, () => {
  console.log(`S05 Note API listening on ${PORT}`);
});

export { app };
```

```typescript
// src/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'notes',
  password: process.env.PGPASSWORD || 'notes',
  database: process.env.PGDATABASE || 'notesdb',
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    )
  `);
}
```

```typescript
// src/routes.ts
import { Router, type Request, type Response } from 'express';
import { pool } from './db.js';
```

### 4. Environment variables in ESM

```typescript
// ESM has no `require('dotenv').config()` by default.
// Options:

// 1. Use node --env-file (Node 20+):
// node --env-file=.env dist/index.js

// 2. Use dotenv with dynamic import:
import dotenv from 'dotenv';
dotenv.config();

// 3. Use tsx which handles .env automatically in dev:
// "dev": "tsx watch src/index.ts"
```

## The PAIN of Top-Level await

```typescript
// ESM supports top-level await:
await initDb(); // Works in ESM

// CommonJS requires wrapping:
(async () => { await initDb(); })(); // Awkward
```

Top-level await in ESM makes initialization code cleaner.

## ESM Evolution in Note API

| Version | Module system | Driver flexibility |
|---------|--------------|-------------------|
| v1-5 | CommonJS | ❌ Limited to CJS drivers |
| v6 | ESM | ✓ Can use any driver |

## The Realization

> Junior: "Top-level await makes my initialization code so much cleaner. No more async IIFE wrappers."
> 
> You: "ESM isn't just about `import` vs `require`. It's about aligning Node.js with the web platform. Top-level await, `import.meta.url`, `node:` prefixes — these are web standards. Learning them future-proofs your skills."

## The Next PAIN

ESM works. But your database connection points to `localhost:5432`. You deploy to production. The database is a managed service. Connection fails. Your app crashes on startup. No graceful degradation.

## Next: v7 — Production Setup
