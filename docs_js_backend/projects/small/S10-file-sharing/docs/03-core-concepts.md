# S10 File Sharing — Core Concepts

## Signed URLs

A signed URL grants temporary, scoped access to a private resource without requiring the user to authenticate.

### How S3 Presigned URLs Work
1. The server constructs a URL with query parameters containing:
   - Expiration timestamp
   - Resource path
   - HMAC-SHA256 signature of the above
2. The client uses the URL directly.
3. S3 verifies the signature and timestamp. If valid, it serves the object.

### Local Implementation (Conceptual)
```typescript
function signDownload(token: string, storageKey: string, expiresAt: number): string {
  const payload = `${token}:${storageKey}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `/download/${token}?expires=${expiresAt}&signature=${signature}`;
}
```

The server validates the signature and expiration on every request, ensuring the URL cannot be tampered with.

## Token Expiration

The project generates tokens with a 24-hour expiration:
```typescript
const expiresAt = Date.now() + EXPIRY_MS;
```

### The Bug
The download endpoint does **not** check `expires_at`:
```typescript
// BUG: missing expiration check
if (!row) return res.status(404).json({ error: 'Not found' });
const buffer = readFile(row.storage_key);
```

### Fix
```typescript
if (Date.now() > row.expires_at) {
  return res.status(410).json({ error: 'Link expired' });
}
```

**HTTP 410 Gone** is semantically correct for expired resources.

## Storage Abstraction

A good storage layer hides the backend implementation:

```typescript
interface StorageAdapter {
  saveFile(buffer: Buffer, filename: string): string; // returns storage key
  readFile(key: string): Buffer;
  deleteFile(key: string): void;
}
```

### Local Adapter (Current)
```typescript
export function saveFile(buffer: Buffer, filename: string): string {
  const key = `${uuidv4()}-${filename}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
  return key;
}
```

### S3 Adapter
```typescript
export function saveFile(buffer: Buffer, filename: string): string {
  const key = `${uuidv4()}/${filename}`;
  s3.putObject({ Bucket: 'files', Key: key, Body: buffer });
  return key;
}
```

The router (`files.ts`) never knows which adapter is in use.

## Cleanup Jobs

Expired files must be purged to prevent disk exhaustion.

### Strategy 1: Cron Job (Node.js + `node-cron`)
```typescript
cron.schedule('0 0 * * *', () => {
  const expired = db.prepare('SELECT storage_key FROM files WHERE expires_at < ?').all(Date.now());
  for (const row of expired) {
    deleteFile(row.storage_key);
    db.prepare('DELETE FROM files WHERE storage_key = ?').run(row.storage_key);
  }
});
```

### Strategy 2: Database Event / Trigger
SQLite does not support time-based triggers. PostgreSQL could use `pg_cron`.

### Strategy 3: Lazy Cleanup
Delete the file on first access after expiry:
```typescript
if (Date.now() > row.expires_at) {
  deleteFile(row.storage_key);
  db.prepare('DELETE FROM files WHERE token = ?').run(token);
  return res.status(410).json({ error: 'Expired' });
}
```
- **Pros**: No background job needed.
- **Cons**: Unexpired files accumulate until accessed; disk may fill up with abandoned uploads.

## Path Traversal

Path traversal allows an attacker to read or write files outside the intended directory by manipulating filenames containing `../`.

### The Vulnerability
```typescript
const key = filename; // user-controlled
const filePath = path.join(UPLOAD_DIR, key);
fs.writeFileSync(filePath, buffer);
```

**Attack**:
```json
{
  "filename": "../../../etc/passwd",
  "file": "..."
}
```
This writes to `/etc/passwd` (or attempts to).

### Fix 1: Sanitize Filename
```typescript
import path from 'path';
const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
const key = `${uuidv4()}-${safeName}`;
```

### Fix 2: Use UUID as Directory Key
```typescript
const key = uuidv4();
fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
// Store original filename in the database for Content-Disposition header
```

### Fix 3: Chroot / Container Boundaries
Run the application in a container where `UPLOAD_DIR` is the only writable path. Even if traversal succeeds, the attacker cannot escape the container.
