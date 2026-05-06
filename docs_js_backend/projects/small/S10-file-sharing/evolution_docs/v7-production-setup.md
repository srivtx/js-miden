# v7 — Production Setup

Your file sharing API works. It has safe storage, expiring tokens, download tracking, validation, logs, and tests. But production file sharing has unique challenges.

## Pain #1: Local Storage Doesn't Scale

You're writing files to `/tmp/s10-uploads`. On a single server, fine. But you deploy to the cloud with 3 app instances. User uploads to instance A, then tries to download from instance B. The file doesn't exist.

**Fix:** Object storage (S3, MinIO, Cloudflare R2).

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Upload
await s3.send(new PutObjectCommand({
  Bucket: process.env.BUCKET_NAME,
  Key: storageKey,
  Body: buffer,
}));

// Generate signed URL (expires in 1 hour)
const command = new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: storageKey });
const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
```

Now all instances share the same storage backend.

## Pain #2: No Access Control

Anyone with a token can download. You need to restrict files to specific users.

**Fix:** Add an `owner_id` field and check it.

```ts
// Upload
db.prepare('INSERT INTO files (token, owner_id, ...) VALUES (?, ?, ...)').run(token, req.user.id);

// Download
const file = db.prepare('SELECT * FROM files WHERE token = ?').get(token);
if (file.owner_id !== req.user.id) {
  return res.status(403).json({ error: 'Access denied' });
}
```

## Pain #3: Large Files

Users try to upload 2GB videos. Your server runs out of memory because you're buffering the entire file.

**Fix:** Stream uploads and use multipart uploads for S3.

```ts
// Express with streaming
app.post('/upload', (req, res) => {
  const stream = req.pipe(fs.createWriteStream(tempPath));
  // Stream to S3 multipart
});
```

## Pain #4: No Cleanup

Expired files accumulate forever. Your storage bill grows.

**Fix:** A background job that deletes expired files.

```ts
setInterval(() => {
  const expired = db.prepare('SELECT token, storage_key FROM files WHERE expires_at < ?').all(Date.now());
  for (const file of expired) {
    deleteFile(file.storage_key);
    db.prepare('DELETE FROM files WHERE token = ?').run(file.token);
  }
}, 60 * 60 * 1000); // hourly
```

## Pain #5: Environment Config

You hardcoded `/tmp/s10-uploads` and 24-hour expiry. Production needs flexibility.

**Fix:** Env vars.

```ts
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';
const EXPIRY_MS = parseInt(process.env.EXPIRY_HOURS || '24') * 60 * 60 * 1000;
```

## Final Checklist

- [ ] Object storage (S3/MinIO/R2) instead of local filesystem
- [ ] Signed URLs with configurable expiry
- [ ] Access control (owner checks)
- [ ] Streaming for large files
- [ ] Background cleanup job
- [ ] Rate limiting on uploads
- [ ] File type validation (not just extension)
- [ ] Virus scanning (ClamAV or cloud service)
- [ ] Graceful shutdown
- [ ] Health check endpoint

This is a production file sharing API. It started as direct file links. Now it has secure, expiring, tracked, access-controlled downloads backed by scalable storage.
