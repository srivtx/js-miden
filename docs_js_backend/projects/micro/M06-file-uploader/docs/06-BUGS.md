# 06-BUGS.md — File Uploader (M06)

## The Bug: Memory Storage Crashes on Large Files

### WHAT

The upload middleware is configured with `multer.memoryStorage()`. This buffers the entire uploaded file into a Node.js `Buffer` in the V8 heap. The file is **not written to disk**, so:

1. The returned URL points to a non-existent file.
2. Under concurrent load, memory usage grows unbounded.
3. The process can crash with `FATAL ERROR: JavaScript heap out of memory`.

### WHY IT HAPPENS

#### Node.js Memory Architecture

Node.js runs on the V8 JavaScript engine. V8 allocates memory in two main areas:

| Area | Default Limit (64-bit) | What Lives Here |
|------|------------------------|-----------------|
| **Heap** | ~1.4 GB (adjustable with `--max-old-space-size`) | Objects, arrays, Buffers < 8 KB (in old space) |
| **Stack** | ~1 MB | Function call frames |

A `Buffer` allocated by `memoryStorage` lives in the **heap**. Each concurrent upload adds its full size to the heap.

#### The Math of a Crash

```
Scenario: 100 concurrent users uploading 5 MB files
Heap used by uploads: 100 × 5 MB = 500 MB

Scenario: 50 concurrent users uploading 50 MB files
Heap used by uploads: 50 × 50 MB = 2,500 MB
Default heap limit: 1,400 MB
Result: FATAL ERROR: JavaScript heap out of memory
```

Even with the 5 MB limit enforced in this project, memory is not freed until:
- The request handler finishes.
- Garbage collection runs.
- The `Buffer` is no longer referenced.

Under sustained load, GC cannot keep up, and the process dies.

#### The `memoryStorage` Source Behavior

```typescript
// Simplified internals of multer memoryStorage
function memoryStorage() {
  return {
    _handleFile(req, file, cb) {
      const chunks: Buffer[] = [];
      file.stream.on('data', (chunk) => chunks.push(chunk));
      file.stream.on('end', () => {
        cb(null, { buffer: Buffer.concat(chunks) });
      });
    }
  };
}
```

It concatenates every chunk into one giant `Buffer`. There is no backpressure; the stream flows as fast as the network allows.

### THE TEST FAILURE

The test "should save the uploaded file to local disk" fails because:

```typescript
const res = await request(app)
  .post('/upload')
  .attach('image', Buffer.from('fake-image-data'), 'test-image.png');

expect(res.status).toBe(200);
expect(fs.existsSync(filePath)).toBe(true); // ❌ FALSE — file never written
```

`req.file` exists and contains a `buffer` property, but no file exists on disk.

### HOW TO REPRODUCE THE CRASH

Create a stress test:

```typescript
import request from 'supertest';
import app from './src/server.js';

async function crashTest() {
  const promises = [];
  for (let i = 0; i < 500; i++) {
    const big = Buffer.alloc(4 * 1024 * 1024); // 4 MB each
    promises.push(request(app).post('/upload').attach('image', big, 'big.png'));
  }
  await Promise.all(promises); // Likely crashes before completion
}
```

500 × 4 MB = 2 GB of buffers alive simultaneously → **process crash**.

### THE FIX: diskStorage with Streaming

Replace `memoryStorage` with `diskStorage`:

```typescript
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) ? ext : '';
    cb(null, `${crypto.randomUUID()}${safe}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
```

**Why this fixes it:**
- `diskStorage` creates a `fs.WriteStream`.
- Incoming chunks are piped directly to disk.
- Only a small kernel buffer (typically 64 KB) is held in memory at a time.
- Memory usage stays flat regardless of file size or concurrency.

### WRONG vs RIGHT

| WRONG (`memoryStorage`) | RIGHT (`diskStorage`) |
|-------------------------|-----------------------|
| File lives in V8 heap | File lives on disk |
| Memory ∝ file size × concurrency | Memory ∝ small OS buffer (constant) |
| File disappears after response | File persists for static serving |
| No backpressure (buffers everything) | Backpressure via `fs.WriteStream` |
| Crash risk under load | Stable under any load |

### DIAGRAM: Memory vs Disk Storage

```
                    memoryStorage (BUG)
CLIENT ──► Network ──► Multer ──► Buffer.concat(chunks)
                                      │
                                      ▼
                              ┌───────────────┐
                              │  V8 Heap      │
                              │  [5MB Buffer] │
                              │  [5MB Buffer] │
                              │  [5MB Buffer] │ ← grows with each upload
                              │  ...          │
                              └───────────────┘
                                      │
                                      ▼
                              FATAL ERROR: heap out of memory


                    diskStorage (FIX)
CLIENT ──► Network ──► Multer ──► fs.WriteStream('uploads/<uuid>.png')
                                      │
                                      ▼
                              ┌───────────────┐
                              │  OS Buffer    │
                              │  [64 KB]      │ ← constant size
                              └───────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Filesystem   │
                              │  uploads/     │
                              └───────────────┘
```

### SOURCES

- [Node.js Docs — Buffer](https://nodejs.org/api/buffer.html)
- [Node.js Docs — Stream](https://nodejs.org/api/stream.html)
- V8 Blog, "Memory Management," 2023.
- Multer documentation.
