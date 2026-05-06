# v4 — Add Logging (Image Resizer)

## The Scenario

It's 2am. Users report "images won't load." Your junior checks the server — it's running. They check disk space — fine. They check the upload directory — empty. "What happened to the uploads?" they ask. You have no logs.

## The PAIN: Silent Data Loss

From v3:

```typescript
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  const id = req.file.filename.split('.')[0];
  uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
  res.json({ id, filename: req.file.filename });
});
```

### What breaks in production:

1. **Upload failures invisible**: Multer silently fails on some file types. No log. User gets 400. You don't know why.

2. **Memory spikes invisible**: A 50MB image causes a 2-second pause. No log. You only find out when monitoring alerts on CPU.

3. **Resize errors invisible**: Sharp throws on corrupt images. Caught by Express? Maybe. Logged? No.

4. **No audit trail**: User claims "I uploaded this yesterday, where is it?" You have no record of upload ID, timestamp, or IP.

## The Solution: Structured Logging for File Operations

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
```

```typescript
// routes.ts
import { logger } from './logger.js';

router.post('/upload', upload.single('image'), (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /upload', ip: req.ip });
  
  if (!req.file) {
    childLogger.warn('Upload rejected: no file provided');
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  
  childLogger.info({
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  }, 'Image uploaded');
  
  const id = req.file.filename.split('.')[0];
  uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
  res.json({ id, filename: req.file.filename });
});

router.get('/resize/:id', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'GET /resize/:id', imageId: req.params.id });
  const startTime = Date.now();
  
  try {
    const meta = uploads.get(req.params.id);
    if (!meta) {
      childLogger.warn('Resize requested for missing image');
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    
    const parseResult = resizeQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      childLogger.warn({ issues: parseResult.error.issues }, 'Invalid resize parameters');
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }
    
    const { width, height, format } = parseResult.data;
    childLogger.info({ width, height, format }, 'Resizing image');
    
    const buffer = await readFile(join(UPLOAD_DIR, meta.filename));
    let pipeline = sharp(buffer);
    if (width || height) {
      pipeline = pipeline.resize(width, height, { fit: 'inside' });
    }
    if (format) {
      pipeline = pipeline.toFormat(format);
    }
    
    const resized = await pipeline.toBuffer();
    const duration = Date.now() - startTime;
    
    childLogger.info({
      durationMs: duration,
      outputSize: resized.length,
      outputFormat: format || meta.mimetype,
    }, 'Image resized successfully');
    
    res.set('Content-Type', `image/${format || meta.mimetype.split('/')[1]}`);
    res.send(resized);
  } catch (err) {
    childLogger.error({ err }, 'Image resize failed');
    res.status(500).json({ error: 'Image processing failed' });
  }
});
```

### What structured logging gives you:

| Need | console.log | Structured logger |
|------|------------|-------------------|
| Track upload sizes | ❌ No data | ✓ Size histogram for capacity planning |
| Resize latency | ❌ No timing | ✓ `durationMs` for performance analysis |
| Error root cause | ❌ Stack trace lost | ✓ Full error object with request context |
| Missing image patterns | ❌ Manual debugging | ✓ Query logs for 404s |
| Abuse detection | ❌ No visibility | ✓ Track requests per IP, per image |

## The PAIN of Memory Issues

```typescript
// Without logging:
// User uploads 10MB image
// Server memory jumps
// No log entry
// You only find out when OOM killer strikes

// With logging:
// `size: 10485760` in upload log
// `outputSize: 5242880` in resize log
// Pattern: input/output ratio helps detect anomalies
```

## Logging Evolution in Image Resizer

| Version | Logging | File operation visibility |
|---------|---------|--------------------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral |
| v3 (Validation) | console.log | Same problems |
| v4 (Structured) | JSON with file metadata | Full audit trail |

## The Realization

> Junior: "I logged upload sizes and discovered users are uploading 20MB PNGs. We added a 10MB limit and CPU usage dropped 60%."
> 
> You: "File operations are resource-intensive. Logs are your profiler. They tell you what users actually do, not what you think they do."

## The Next PAIN

Logging tells you what happened. But when you refactor Sharp usage or change validation rules, how do you know nothing broke? You test it.

## Next: v5 — Add Testing
