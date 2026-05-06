# S13 API Key Manager — Overview

## Project Goal
Build an API key lifecycle manager that generates opaque keys, revokes them, lists active keys, and protects endpoints with per-key rate limiting. The project demonstrates key hashing strategies, timing-safe comparison, scoping, and rotation patterns.

## Key Features
- **Generate keys**: `POST /keys` creates a new `pk_live_` prefixed key.
- **List keys**: `GET /keys` returns active keys (metadata only, never the full secret).
- **Revoke keys**: `DELETE /keys/:id` invalidates a key.
- **Authenticate**: `authMiddleware` validates `x-api-key` header and enforces rate limits.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: SQLite (`better-sqlite3`)
- **Hashing**: SHA-256 (for API keys)
- **Language**: TypeScript

## High-Level Architecture

```
Client → POST /keys          → SQLite (insert key metadata)
Client → GET /keys           → SQLite (list active)
Client → DELETE /keys/:id    → SQLite (revoke)
Client → GET /protected      → authMiddleware → rate limit check → handler
```

## Entry Points
- `src/index.ts` — Server bootstrap.
- `src/app.ts` — Express app setup.
- `src/keys.ts` — Key generation, listing, revocation.
- `src/middleware.ts` — Authentication and rate limiting.
- `src/db.ts` — SQLite initialization.
- `tests/keys.test.ts` — Test suite.

## Scope & Limitations
This project intentionally contains two security issues:
1. **Plaintext storage**: The `key_hash` column stores the full key, not a hash.
2. **No expiration check**: Keys are valid forever even if `expires_at` is set.
These are documented as learning exercises.
