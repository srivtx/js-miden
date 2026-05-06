# S04 Image Resizer — Error Handling

## Sharp Error Types

| Error | Cause | Response |
|-------|-------|----------|
| `Input file is missing` | File deleted before resize | 404 |
| `VipsImage: width not in range` | Negative/invalid width | 400 |
| `VipsJpeg: Invalid SOS parameters` | Corrupt JPEG | 400 |
| `Out of memory` | Image too large | 500 (log, sanitize response) |
| `Timeout` | Processing exceeded limit | 504 |

Current code catches **none** of these. The default Express error handler returns HTML stack traces in development and empty 500s in production.

## Recommended Error Handler

```ts
router.get('/resize/:id', async (req, res, next) => {
  try {
    // ... validation ...
    const out = await sharp(filePath).resize(...).toBuffer();
    res.set('Content-Type', `image/${format}`);
    res.send(out);
  } catch (err) {
    if (err.message.includes('Input file is missing')) {
      return res.status(404).json({ error: 'Image not found' });
    }
    if (err.message.includes('width') || err.message.includes('height')) {
      return res.status(400).json({ error: 'Invalid dimensions' });
    }
    next(err); // Let global handler deal with unexpected errors
  }
});
```

## File Not Found

The code checks `uploads.get(id)` but not whether the file still exists on disk. If the process restarts or the file is manually deleted, `readFile` throws `ENOENT`.

**Fix**: Verify file existence before reading:
```ts
import { access } from 'node:fs/promises';
try {
  await access(filePath);
} catch {
  return res.status(404).json({ error: 'Image file missing' });
}
```

## Multer Errors

Multer can throw:
- `LIMIT_FILE_SIZE`: File exceeds `limits.fileSize`
- `LIMIT_UNEXPECTED_FILE`: Wrong field name
- `LIMIT_FILE_COUNT`: Too many files

These are not handled and crash the process unless a custom error handler is registered.

## Graceful Shutdown

Image processing is CPU-bound and cannot be interrupted mid-operation without corrupting output. On `SIGTERM`:
1. Stop accepting new uploads.
2. Wait for in-flight resizes to complete (with a 30-second max timeout).
3. Close HTTP server.

## Logging

Log every resize with dimensions and duration:
```json
{
  "level": "info",
  "msg": "image_resize",
  "id": "uuid",
  "input_format": "jpeg",
  "output_format": "webp",
  "width": 200,
  "height": 200,
  "duration_ms": 45
}
```

This helps identify abuse (e.g., someone hammering the resize endpoint with 4K dimensions).
