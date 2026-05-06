# v3 — Adding Validation

You just found a file in `/etc/passwd` on your server. Someone uploaded a file named `../../../etc/passwd` and your code wrote it there because you used the raw filename as the storage path.

This is path traversal. It's a critical security vulnerability.

## The Fix: Validation + Safe Storage

You add `zod` for input validation and sanitize filenames.

```ts
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';

const UploadSchema = z.object({
  filename: z.string().min(1).max(255),
  file: z.string().min(1), // base64
});

// Store files by UUID, not by user-provided filename
function saveFile(buffer: Buffer, _originalName: string): string {
  const key = uuidv4();
  const filePath = path.join(UPLOAD_DIR, key);
  fs.writeFileSync(filePath, buffer);
  return key;
}
```

Now:
- `../../../etc/passwd` → stored as `a1b2c3d4...`, not in `/etc`
- Empty filename → rejected
- Missing file data → rejected

## Expiring Links

You add tokens with expiration.

```ts
const EXPIRY_MS = 24 * 60 * 60 * 1000;
const token = uuidv4();
const expiresAt = Date.now() + EXPIRY_MS;

db.prepare(
  'INSERT INTO files (token, original_name, storage_key, expires_at) VALUES (?, ?, ?, ?)'
).run(token, originalName, storageKey, expiresAt);
```

Users get a token-based URL: `/download/abc-123`. Not the raw filename.

## The Bug

You check expiration at upload time. But you forgot to check it at download time. The token works forever.

**Fix:** Check expiration on every download.

```ts
if (Date.now() > row.expires_at) {
  return res.status(410).json({ error: 'Link expired' });
}
```

**Next:** Let's add logging so we know what's being downloaded.
