# 08-CRITIQUE

## Senior Engineer Review

### What is done well
- Storage abstraction makes S3 migration painless.
- Magic-number validation is correctly prioritized over extension checks.
- Sharp is the right tool for image processing in Node.js.

### What is risky
- The virus scanning stub is just a stub. In production, an un-scanned file reaching S3 is a liability. Integrate ClamAV or a cloud scanning API before launch.
- No cleanup of temp files if validation throws after Multer writes to disk. Use `fs.unlink` in a `finally` block.
- Image processing runs in the request path. For large images, this blocks the event loop. Move to a background queue.

### What is missing
- Signed upload URLs. For scale, the client should upload directly to S3/MinIO, not through the Express server.
- Content-Disposition headers for downloads.
- Quota tracking per user.

### The Bug
Path traversal via `originalname` is a classic and severe vulnerability. Always generate a server-side UUID for filesystem storage. Keep the original name in metadata for display only.
