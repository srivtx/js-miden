# v3 — Add Validation (Image Resizer)

## The Scenario

It's 2am. Your junior added TypeScript. "Width and height are numbers now!" they celebrate. Then a user requests `GET /resize/123?width=-500` and Sharp throws an exception that crashes the process. TypeScript saw `number` — it didn't see negative.

## The PAIN: Domain Validation > Type Validation

From v2:

```typescript
const w = width ? parseInt(width, 10) : undefined;
const h = height ? parseInt(height, 10) : undefined;

// User sends: width=-500, height=0
// parseInt returns -500 and 0 — both are valid numbers!
// Sharp crashes: "Expected positive integer for width"
```

TypeScript's `number` type includes `-Infinity`, `NaN`, `0`, and `999999`. None of these are valid image dimensions.

### Real crashes in production:

```
GET /resize/123?width=-100     -> Sharp throws
GET /resize/123?width=0        -> Sharp throws or 1x1 output
GET /resize/123?width=99999    -> Memory exhaustion (40GB buffer attempt)
GET /resize/123?format=exe     -> Sharp throws (unsupported format)
GET /resize/123                -> No dimensions, confusing behavior
```

## The Solution: Zod Schema with Domain Rules

```typescript
import { z } from 'zod';

const resizeQuerySchema = z.object({
  width: z.coerce.number().int().min(1).max(4096).optional(),
  height: z.coerce.number().int().min(1).max(4096).optional(),
  format: z.enum(['jpeg', 'png', 'webp']).optional(),
}).refine(
  data => data.width || data.height,
  { message: 'At least one dimension is required' }
);
```

```typescript
router.get('/resize/:id', async (req: Request, res: Response) => {
  const parseResult = resizeQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid parameters',
      issues: parseResult.error.issues,
    });
    return;
  }
  
  const { width, height, format } = parseResult.data;
  // width: number | undefined, guaranteed to be 1-4096 if present
  // format: 'jpeg' | 'png' | 'webp' | undefined
  
  // Safe to pass to Sharp
  let pipeline = sharp(buffer);
  if (width || height) {
    pipeline = pipeline.resize(width, height, { fit: 'inside' });
  }
  if (format) {
    pipeline = pipeline.toFormat(format);
  }
  
  const resized = await pipeline.toBuffer();
  res.send(resized);
});
```

### What validation catches:

| Input | TypeScript | Zod validation | Result |
|-------|-----------|----------------|--------|
| `width=-500` | ✓ number | **Error**: Number must be greater than 0 | Rejected |
| `width=0` | ✓ number | **Error**: Number must be greater than 0 | Rejected |
| `width=99999` | ✓ number | **Error**: Number must be less than or equal to 4096 | Rejected |
| `format=exe` | ✓ string | **Error**: Invalid enum value | Rejected |
| `width=abc` | NaN (runtime) | **Error**: Expected number, received nan | Rejected |
| No width or height | Both undefined | **Error**: At least one dimension is required | Rejected |

## The PAIN of File Upload Validation

```typescript
// The upload endpoint also needs validation:
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

Without upload limits:
- A user uploads a 2GB "image" → server runs out of disk/RAM
- A user uploads 1,000 files at once → DoS
- A user uploads `malicious.exe` with `image/jpeg` mimetype → needs content-type validation

## Validation Evolution in Image Resizer

| Version | Validation | What crashes |
|---------|-----------|--------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type only | Negative dims, huge dims, bad formats |
| v3 (Zod) | Domain rules | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected `width=99999` before Sharp even saw it. Last week that would have crashed the server."
> 
> You: "Domain validation is your contract with dangerous libraries. Sharp is powerful — it'll try to allocate a 40GB buffer if you ask nicely. Never ask."

## The Next PAIN

Validation prevents crashes, but when Sharp *does* throw (corrupt image, unsupported format), you have no visibility. The error goes to console.log and vanishes into Docker logs that nobody reads.

## Next: v4 — Add Logging
