# S10 File Sharing — Database

## Schema

```sql
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0
);
```

## Data Types

### Token (`TEXT UNIQUE`)
UUIDv4 string. The uniqueness constraint prevents accidental token collisions.

### `expires_at` (`INTEGER`)
Unix timestamp in milliseconds. SQLite integers are 64-bit, so they safely hold JavaScript `Date.now()` values until the year 2255.

### `download_count` (`INTEGER DEFAULT 0`)
Denormalized counter incremented on each download. Not critical for security but useful for analytics and abuse detection.

## Indexes

```sql
-- Token lookups (primary download path)
CREATE INDEX idx_files_token ON files(token);

-- Cleanup queries
CREATE INDEX idx_files_expires_at ON files(expires_at);
```

## Decision: Metadata in SQL vs. Object Storage Metadata

### Alternative 1: SQLite Metadata (Current)
- **Pros**: ACID transactions, simple queries, easy to join with other application data.
- **Cons**: Does not scale horizontally; file metadata is tied to the SQLite file.
- **Verdict**: Fine for single-node apps.

### Alternative 2: S3 Object Metadata
Store `original_name`, `expires_at`, and `download_count` as S3 object metadata headers.
- **Pros**: One source of truth, no separate database needed.
- **Cons**: Limited to 2 KB of metadata per object, cannot query across objects efficiently (no SQL `SELECT`).
- **Verdict**: Good for simple systems; painful for analytics and bulk operations.

### Alternative 3: Hybrid (SQL + S3)
Keep lightweight metadata in SQL (token, expiry) and heavy bytes in S3.
- **Pros**: Best of both worlds; SQL is fast for lookups, S3 is cheap for storage.
- **Cons**: Two systems to manage; must handle inconsistency if SQL commit succeeds but S3 upload fails.

## Storage Key Design

A good storage key should be:
- **Opaque**: Reveals nothing about the content.
- **Unique**: No collisions even under race conditions.
- **Flat or Hierarchical**: Flat (`uuid-filename`) is simple; hierarchical (`yyyy/mm/dd/uuid`) improves listing performance in some object stores.

**Current bug**: The storage key is the raw user filename, enabling collisions and path traversal.

**Recommended**:
```typescript
const storageKey = `${uuidv4()}_${path.basename(originalName)}`;
```
