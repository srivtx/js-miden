# M06: File Uploader (Local)

A local file upload microservice built with Express 5, TypeScript, and ESM.

## Setup

```bash
npm install
npm run dev
npm test
```

## API

- `POST /upload` — Multipart form upload. Field name: `image`. Max 5MB. Only jpg, png, gif.
- Static file serving from `/uploads/`

## Phase 2-3 Thinking Framework

### 1. Memory vs Disk Storage (multer config)
- **memoryStorage**: Buffers the entire file in RAM. Fast for tiny files, but dangerous for production because concurrent large uploads can exhaust memory and crash the Node.js process.
- **diskStorage**: Streams the file directly to the filesystem. Slightly more I/O overhead, but bounded memory usage and files are automatically persisted.
- **Decision**: Use `diskStorage` for any file that must survive the request and be served later.

### 2. File Type Validation (magic numbers vs extension)
- **Extension checking**: Trivial to spoof (`malware.exe` renamed to `photo.jpg`).
- **MIME type**: Sent by the client and also spoofable.
- **Magic numbers**: Inspecting the actual file header (e.g., `FF D8 FF` for JPEG) is the only reliable server-side validation. For this micro project we use MIME type as a baseline, but production code should use a library like `file-type` to read magic numbers.

### 3. Filename Sanitization (prevent path traversal)
- Never trust `file.originalname`. A malicious client can send `../../../etc/cron.d/payload`.
- Always generate your own filename (UUID + timestamp) or aggressively sanitize the original name (strip path separators, control characters, and dots).
- **Decision**: Use `crypto.randomUUID()` + preserve the original extension only after validation.

### 4. Size Limits (prevent DoS)
- Without a size limit, an attacker can stream an infinite file and exhaust disk or memory.
- Multer's `limits.fileSize` should be enforced.
- Also consider rate limiting the upload endpoint itself.

## The Bug

`src/middleware/upload.ts` is configured with `multer.memoryStorage()` instead of `multer.diskStorage()`.

**Consequences**:
- Files are **not persisted to disk** after the upload request ends.
- The returned `url` points to a file that does not exist.
- Under load, large concurrent uploads can crash the process due to unbounded memory growth.

## How to Fix

Replace `memoryStorage` with `diskStorage`:

```typescript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});
```

Then update the route to return `req.file.filename` instead of `req.file.originalname`.

## Test Failure

Run `npm test`. The test **"should save the uploaded file to local disk"** fails because `fs.existsSync(filePath)` returns `false`—the file was buffered in memory and never written to disk.
