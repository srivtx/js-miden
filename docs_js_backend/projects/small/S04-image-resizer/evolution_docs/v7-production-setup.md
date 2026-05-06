# v7 — Production Setup (Image Resizer)

## The Scenario

It's 2am. Your junior deploys the image resizer. "Sharp is fast!" they say. Then a user uploads a 50MB TIFF. The server allocates 50MB buffer + 50MB resized buffer + 50MB output buffer. Node's heap explodes. The container restarts. The user tries again. And again. Your junior watches the crash loop and learns about memory limits.

## The PAIN: Image Processing Without Boundaries

From v6:

```typescript
// Buffer-based processing (dangerous)
const buffer = await readFile(filePath); // 50MB into RAM
const resized = await sharp(buffer)
  .resize(width, height)
  .toBuffer(); // Another 50MB
res.send(resized); // Total: 100MB+ for one request
```

Problems:
- No file size limits on upload
- No dimension limits on resize
- No format restrictions
- Buffer-based = memory-bound
- No streaming = blocks event loop for large files

## The Solution: Sharp + Streaming + Limits

### 1. Upload with Multer (Disk Storage + Limits)

```typescript
// src/routes.ts (actual production code)
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = './uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = file.originalname.split('.').pop() || 'bin';
    cb(null, `${id}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});
```

Why disk storage instead of memory?
- **Memory storage**: File stays in RAM. 10MB × 100 concurrent = 1GB.
- **Disk storage**: File goes to filesystem. RAM usage stays flat.

### 2. Validation Schema

```typescript
import { z } from 'zod';

const resizeQuerySchema = z.object({
  width: z.coerce.number().int().min(1).max(4096).optional(),
  height: z.coerce.number().int().min(1).max(4096).optional(),
  format: z.enum(['jpeg', 'png', 'webp']).optional(),
}).refine(data => data.width || data.height, {
  message: 'At least one dimension is required',
});
```

### 3. Resize Route (Buffer-Based with Validation)

```typescript
const uploads = new Map<string, { filename: string; mimetype: string }>();

export const router = Router();

router.post('/upload', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  const id = req.file.filename.split('.')[0];
  uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
  res.json({ id, filename: req.file.filename });
});

router.get('/resize/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const meta = uploads.get(id);
  if (!meta) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const parseResult = resizeQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid parameters', issues: parseResult.error.issues });
    return;
  }

  const { width, height, format } = parseResult.data;

  // BUG: Reads entire file into memory instead of streaming
  const filePath = join(UPLOAD_DIR, meta.filename);
  const buffer = await readFile(filePath);

  let pipeline = sharp(buffer);
  if (width || height) {
    pipeline = pipeline.resize(width, height, { fit: 'inside' });
  }

  const outputFormat = format || meta.mimetype.split('/')[1];
  if (['jpeg', 'jpg', 'png', 'webp'].includes(outputFormat)) {
    pipeline = pipeline.toFormat(outputFormat === 'jpg' ? 'jpeg' : (outputFormat as keyof sharp.FormatEnum));
  }

  const resized = await pipeline.toBuffer();
  res.set('Content-Type', `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}`);
  res.send(resized);
});
```

### 4. The Streaming Evolution (Not Yet Implemented)

The current code uses `readFile` (buffer-based). The next evolution is streaming:

```typescript
// Future improvement:
import { createReadStream } from 'node:fs';

// Stream-based (memory-efficient):
createReadStream(filePath)
  .pipe(sharp().resize(width, height))
  .pipe(res);
// Memory usage stays constant regardless of file size
```

Why isn't it implemented yet?
- Streaming error handling is more complex
- Content-Length header can't be known in advance
- Sharp streaming has different API semantics

This is a documented next step, not a bug.

### 5. The Buffer Bug (Documented)

```typescript
// BUG: No validation of width/height (negative values or zero crash sharp)
// BUG: Reads entire file into memory instead of streaming
```

Zod validation fixes the first bug. Streaming would fix the second.

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Storage | Memory (Map) | Disk + metadata Map |
| Upload limits | None | 10MB, image-only |
| Resize validation | None | Zod (1-4096 dims, valid formats) |
| Format support | JPEG only | JPEG, PNG, WebP |
| Memory usage | Unbounded | Bounded by file size |
| Types | None | TypeScript |
| Tests | None | Vitest (upload, resize, 404) |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I added a 10MB upload limit and Zod validation for dimensions. Before that, a single request could crash the server. Image processing looks simple but it's actually one of the most dangerous endpoints."
> 
> You: "Images are the ultimate user-controlled binary payload. They can be huge, malformed, or maliciously crafted. Every image endpoint needs: size limits, dimension limits, format whitelisting, and memory bounds. Sharp is powerful — that power can hurt you."

## Files in this project

```
S04-image-resizer/
├── src/
│   ├── index.ts          # Entry point + server export
│   └── routes.ts         # Upload + resize + validation
├── tests/
│   └── resize.test.ts    # Vitest (upload, resize, format, 404)
├── uploads/              # Disk storage directory
├── package.json          # ESM
└── tsconfig.json
```

## What You Learned

1. **Disk storage > memory storage**: For file uploads, always prefer disk. RAM is for processing, not storage.
2. **Validate before processing**: Check dimensions, format, and file size before touching Sharp.
3. **Format conversion**: Users want WebP for web, PNG for transparency, JPEG for photos. Support the common formats.
4. **Memory is the bottleneck**: Image processing is I/O and memory bound, not CPU bound. Streaming is the solution.
5. **Sharp is dangerous**: It'll do what you ask, including allocating 40GB buffers. Guard every parameter.
