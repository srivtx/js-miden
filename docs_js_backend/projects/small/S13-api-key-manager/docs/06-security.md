# S13 API Key Manager — Security

## Plaintext Storage (Critical)

The `key_hash` column stores the full API key in plaintext:
```typescript
db.prepare('INSERT INTO api_keys (key_hash, ...) VALUES (?, ...)').run(fullKey, ...);
```

If the database is compromised (SQL injection, backup leak, insider threat), every key is immediately usable.

### Fix
```typescript
const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
db.prepare('INSERT INTO api_keys (key_hash, ...) VALUES (?, ...)').run(hash, ...);
```

## Timing Attack on Key Comparison

The current lookup `WHERE key_hash = ?` relies on SQLite's string comparison, which is not constant-time. An attacker with precise network timing could brute-force keys byte-by-byte.

### Fix
```typescript
const row = db.prepare('SELECT * FROM api_keys WHERE revoked = 0').all();
const providedHash = crypto.createHash('sha256').update(key).digest();
for (const r of rows) {
  const storedHash = Buffer.from(r.key_hash, 'hex');
  if (crypto.timingSafeEqual(providedHash, storedHash)) {
    // match
  }
}
```

## No Expiration

Keys are valid forever. A key leaked in a GitHub commit 3 years ago is still active.

### Fix
Enforce expiration:
```typescript
if (row.expires_at && Date.now() > row.expires_at) {
  return res.status(401).json({ error: 'API key expired' });
}
```

## Key Enumeration

If key IDs are sequential integers, an attacker can enumerate all active keys via `GET /keys/1`, `GET /keys/2`, etc. Use UUIDs for key IDs in public-facing APIs.

## Rate Limit Bypass

The in-memory rate limiter is per-process. In a multi-node deployment, each node maintains its own counters, allowing an attacker to multiply their quota by the number of nodes.

### Fix
Use Redis or a shared store for distributed rate limiting.

## Scope Escalation

If the middleware does not check scopes, a read-only key can perform write operations. Always validate:
```typescript
const scopes = JSON.parse(row.scopes || '[]');
if (!scopes.includes(requiredScope)) return 403;
```
