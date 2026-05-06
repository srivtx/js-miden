# v6-switch-to-esm

## Goal
Enable ESM and replace sequential codes with cryptographically random ones.

## Changes
1. `"type": "module"` in `package.json`.
2. Replace sequential `encode(++counter)` with `nanoid`.
3. Handle collision gracefully with retry loop.

## Code

```ts
// src/services/shortener.ts
import { nanoid } from 'nanoid';

export async function createShortCode(url: string, customCode?: string, expiresInDays?: number): Promise<string> {
  const shortCode = customCode || nanoid(8);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

  try {
    await pool.query('INSERT INTO urls (short_code, url, expires_at) VALUES ($1, $2, $3)', [shortCode, url, expiresAt]);
  } catch (err: any) {
    if (err.code === '23505') {
      if (customCode) throw new Error('Custom code already exists');
      // Retry once with a new random code
      return createShortCode(url, undefined, expiresInDays);
    }
    throw err;
  }

  return shortCode;
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

## Decisions
- `nanoid(8)` gives ~2 trillion combinations — short enough for URLs, long enough to avoid collisions.
- Retry loop only for auto-generated codes; custom codes fail fast.

## Risks
- `nanoid` uses hardware RNG. In containerized environments without `/dev/random`, fallback to `crypto.randomUUID` base62 encoding.
