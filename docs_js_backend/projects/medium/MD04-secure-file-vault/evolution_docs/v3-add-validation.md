# MD04 Secure File Vault — v3 Adding Validation

## The Attack

You thought TypeScript was enough. Then a user sent this:

```bash
curl -X POST http://localhost:3000/upload \
  --data-binary @/dev/zero \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Length: 10737418240"
```

A 10GB upload of zeros. Your server buffers it in memory. Node crashes. If it somehow survived, the disk fills up.

Then someone sent:
```json
{ "filename": "../../../.ssh/authorized_keys", "contentType": "text/plain" }
```

If you use the original filename as a storage path, they just overwrote your SSH authorized keys.

## The Fix: Defense in Depth

### 1. Request Validation (Zod)

```ts
import { z } from 'zod';

const uploadMetaSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[^\\/:*?"<>|]+$/),
  contentType: z.string().regex(/^\w+\/[\w.+-]+$/),
  size: z.number().int().min(1).max(100 * 1024 * 1024), // 100MB max
});

export type UploadMeta = z.infer<typeof uploadMetaSchema>;
```

- `filename` cannot contain path separators
- `contentType` must be a valid MIME type
- `size` is capped at 100MB

### 2. Path Sanitization

```ts
import { randomUUID } from 'crypto';
import path from 'path';

function sanitizeFilename(input: string): string {
  // Remove path components
  const basename = path.basename(input);
  // Replace dangerous chars
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getStoragePath(fileId: string): string {
  // Shard into subdirectories: uploads/ab/cd/abcdef123...
  const shard1 = fileId.slice(0, 2);
  const shard2 = fileId.slice(2, 4);
  return path.join(UPLOAD_DIR, shard1, shard2, fileId);
}
```

The storage path is derived from a UUID, never from user input.

### 3. Streaming with Limits

```ts
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { LimitExceededError } from './errors';

class SizeLimitStream extends Transform {
  private received = 0;
  constructor(private limit: number) { super(); }
  _transform(chunk: Buffer, _enc: string, cb: TransformCallback) {
    this.received += chunk.length;
    if (this.received > this.limit) {
      return cb(new LimitExceededError(`Upload exceeds ${this.limit} bytes`));
    }
    cb(null, chunk);
  }
}

async function upload(req: Request): Promise<FileUpload> {
  const meta = uploadMetaSchema.parse(req.body.meta);
  const fileId = randomUUID();
  const storagePath = getStoragePath(fileId);
  await mkdir(path.dirname(storagePath), { recursive: true });

  const writeStream = createWriteStream(storagePath);
  const limitStream = new SizeLimitStream(meta.size);

  await pipeline(req.fileStream, limitStream, writeStream);

  // Verify checksum
  const checksum = await computeChecksum(storagePath);

  await db.query(
    'INSERT INTO files (id, filename, original_name, content_type, size, owner_id, checksum, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
    [fileId, sanitizeFilename(meta.filename), meta.filename, meta.contentType, meta.size, req.userId, checksum]
  );

  return getFile(fileId);
}
```

### 4. Database Constraints

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 104857600),
  owner_id UUID NOT NULL,
  checksum CHAR(64) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encrypted_at_rest BOOLEAN NOT NULL DEFAULT FALSE
);
```

## The Bug

You validate `meta.size` but the actual stream might be larger. The `SizeLimitStream` catches it, but only after writing bytes to disk. A malicious client could send a slightly larger file, fill the disk, and trigger cleanup bugs.

**Next:** Let's add logging so we know who uploaded what and when.
