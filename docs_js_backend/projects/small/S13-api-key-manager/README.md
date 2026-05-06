# S13: API Key Manager

## Overview
An API for generating, revoking, and validating API keys with per-key rate limiting. Demonstrates key hashing, timing-safe comparison, scoping, and rotation strategies.

## Thinking Framework

### PHASE 1: Core Features
- `POST /keys` → generate a new API key.
- `GET /keys` → list active keys.
- `DELETE /keys/:id` → revoke a key.
- `GET /protected` → example endpoint protected by API key + rate limiting.

### PHASE 2-3: Design Decisions
- **Key Prefix**: `pk_live_` vs `pk_test_` allows environments to be distinguished at a glance and prevents test keys from hitting production endpoints.
- **Hashing**: SHA-256 is used for API keys (not bcrypt) because:
  1. API keys are high-entropy random strings (256 bits), so rainbow tables are infeasible.
  2. SHA-256 is fast; bcrypt would add latency to every API request.
  3. API keys are not user-chosen passwords; they are machine-generated secrets.
- **Key Rotation**: Support multiple active keys per user to allow zero-downtime rotation (create new key, migrate clients, revoke old key).
- **Scoping**: `scopes` column stores a JSON array like `["read:users", "write:posts"]` to enforce least privilege.

### PHASE 4: Bugs & Hardening
- **Plaintext storage**: The `key_hash` column stores the full plaintext key, not a hash. If the database is breached, all keys are immediately usable by the attacker.
- **No expiration**: Keys are valid forever. Compromised keys remain active until manually revoked.
- **Timing-unsafe comparison**: The lookup `WHERE key_hash = ?` in SQLite does not guarantee constant-time comparison. An attacker with precise timing could brute-force keys byte-by-byte.

## Project Structure
```
src/
  db.ts        - SQLite schema for api_keys
  keys.ts      - POST /keys, GET /keys, DELETE /keys/:id
  middleware.ts - authMiddleware + rate limiting
  app.ts       - Express composition
  index.ts     - Server bootstrap
tests/
  keys.test.ts - Vitest + Supertest suite
```

## Running
```bash
npm install
npm run dev
npm test
```

## Example Requests
```bash
# Generate key
curl -X POST http://localhost:3000/keys -H "Content-Type: application/json" -d '{"name":"Mobile App"}'

# Use key
curl http://localhost:3000/protected -H "x-api-key: pk_live_..."

# Revoke key
curl -X DELETE http://localhost:3000/keys/1
```
