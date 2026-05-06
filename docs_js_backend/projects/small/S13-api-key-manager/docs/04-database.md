# S13 API Key Manager — Database

## Schema

```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  scopes TEXT,
  rate_limit INTEGER NOT NULL DEFAULT 100,
  expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
```

## Data Types

### `key_hash` (`TEXT`)
Stores the SHA-256 hash of the API key. **In the buggy version, this stores the full plaintext key.**

### `prefix` (`TEXT`)
`pk_live_` or `pk_test_`. Allows environment filtering without hashing.

### `scopes` (`TEXT`)
JSON array of permission strings. Example: `["read:users", "write:posts"]`.

### `expires_at` (`INTEGER`)
Unix timestamp in milliseconds. `NULL` means no expiration.

### `revoked` (`INTEGER DEFAULT 0`)
Soft-delete flag. `0` = active, `1` = revoked. Preserves audit trail.

## Indexes

```sql
-- Fast key lookup
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- List active keys
CREATE INDEX idx_api_keys_revoked ON api_keys(revoked) WHERE revoked = 0;
```

## Decision: Soft Delete vs Hard Delete

### Soft Delete (Current)
- **Pros**: Audit trail, recoverable, supports analytics on revoked keys.
- **Cons**: Table grows forever; requires periodic archival.

### Hard Delete
- **Pros**: Smaller table, GDPR-compliant "right to erasure".
- **Cons**: No history; cannot investigate breaches involving deleted keys.

## Decision: One Key Per Row vs Multiple Keys Per User

This simplified schema does not include `user_id`. In production:

```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  ...
);
```

Multiple keys per user enable:
- **Rotation**: Old and new keys active simultaneously.
- **Scope separation**: One key for mobile app (read-only), one for backend (full access).
