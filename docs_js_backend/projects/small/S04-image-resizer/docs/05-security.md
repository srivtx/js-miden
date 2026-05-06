# S04 Image Resizer — Security

## Intentional Bug: No Width/Height Validation

**Location**: `src/routes.ts`, lines 43-54

```ts
const width = parseInt(req.query.width as string, 10);
const height = parseInt(req.query.height as string, 10);
// ...
let pipeline = sharp(buffer);
if (!Number.isNaN(width) || !Number.isNaN(height)) {
  pipeline = pipeline.resize(width || undefined, height || undefined, { fit: 'inside' });
}
```

### Real-World Consequence
An attacker requests:
```
GET /resize/:id?width=-1&height=-1
GET /resize/:id?width=99999&height=99999
GET /resize/:id?width=0
```

- **Negative values**: Sharp throws an error, but the error is caught... actually it's not caught. The code has no try/catch around `pipeline.toBuffer()`. The Express default error handler returns a stack trace (information disclosure) or hangs.
- **Extreme values**: `width=50000` causes Sharp to allocate a 50,000-pixel-wide output buffer. A 50K × 50K RGBA image is **10 GB** of memory. The process is OOM-killed, taking down the server.
- **Zero values**: Sharp treats 0 as "auto" in some versions, producing unexpected aspect ratios.

### Fix
```ts
const MAX_DIMENSION = 4096;
const width = Math.min(MAX_DIMENSION, Math.max(1, parseInt(req.query.width as string, 10) || 0));
const height = Math.min(MAX_DIMENSION, Math.max(1, parseInt(req.query.height as string, 10) || 0));
if (!width && !height) { res.status(400).json({ error: 'width or height required' }); return; }
```

## Intentional Bug: Buffer Instead of Stream

**Location**: `src/routes.ts`, line 49

```ts
const buffer = await readFile(filePath);
let pipeline = sharp(buffer);
```

### Real-World Consequence
A 20 MB PNG upload (uncompressed to 200 MB in memory) processed by 50 concurrent requests:
- **Memory usage**: 10 GB RSS
- **Container limit**: 2 GB
- **Result**: OOMKill, all requests fail, pod restarts

### Fix
```ts
let pipeline = sharp(filePath); // libvips memory-maps the file
```

Or stream:
```ts
res.set('Content-Type', `image/${format}`);
pipeline = sharp(filePath).resize(width, height);
await pipeline.pipe(res);
```

## MIME Type Trust Vulnerability

**Location**: `src/routes.ts`, line 31

```ts
uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
```

Browsers determine `mimetype` from the file extension. An attacker can upload a polyglot file (valid JPEG header + PHP payload) that the browser labels as `image/jpeg`.

If the application later serves the file with `Content-Type: image/jpeg`, browsers will render it as an image. But if the file is stored on a server that executes `.php` files (e.g., Apache with mod_php), the payload runs.

**Mitigation**:
1. Verify magic bytes after upload.
2. Serve images from a static file server that never executes code (e.g., Nginx `location /uploads` with `default_type image/jpeg`).
3. Rename uploaded files to random IDs with no extension (already done via UUID).

## Denial of Service via Pixel Flood

An attacker crafts a tiny file (1 KB on disk) that decompresses to a gigapixel image. This is known as a **decompression bomb** or **pixel flood**.

**Mitigation**:
```ts
sharp(input)
  .resize(4096, 4096, { fit: 'inside' })
  .timeout({ seconds: 5 }) // abort if processing >5s
  .toBuffer();
```

Also limit input file size in multer:
```ts
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});
```

## Information Disclosure

The route does not catch errors from Sharp. If `sharp(buffer).resize(-1)` throws, Express may leak the stack trace in the response, revealing:
- File system paths (`/Users/dev/project/src/routes.ts`)
- Sharp/libvips versions
- Internal server structure

**Fix**: Add a global error handler that sanitizes error messages:
```ts
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Image processing failed' });
});
```
