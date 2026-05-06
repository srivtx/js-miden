# v2 — Add TypeScript (Image Resizer)

## The Scenario

It's 2am. Your junior is debugging why resized images are 1x1 pixel. "I passed width and height," they say. You look: `req.query.width` is `"100"` (string), they passed it to `sharp.resize()` which accepted it... but `req.query.height` was `undefined` because they typed `heigth` in the client URL.

## The PAIN: Stringly Typed Query Parameters

From v1:

```javascript
app.get('/resize/:id', async (req, res) => {
  const width = parseInt(req.query.width);   // "100" -> 100
  const height = parseInt(req.query.heigth); // undefined -> NaN
  // Sharp receives: resize(100, NaN) — behavior is unpredictable
  
  const resized = await sharp(buffer)
    .resize(width, height)
    .toBuffer();
});
```

Query parameters are always strings. `parseInt` silently returns `NaN` for bad input. Sharp throws exceptions or produces unexpected output. Your users see 500s or distorted images.

## The Solution: TypeScript + Explicit Parsing

```typescript
// types.ts
export interface ResizeQuery {
  width?: string;
  height?: string;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ImageMetadata {
  id: string;
  filename: string;
  mimetype: string;
}
```

```typescript
// routes.ts
import { Request, Response } from 'express';
import { ResizeQuery, ImageMetadata } from './types.js';

router.get('/resize/:id', async (req: Request, res: Response) => {
  const { width, height, format } = req.query as unknown as ResizeQuery;
  
  // TypeScript knows these are strings | undefined
  const w = width ? parseInt(width, 10) : undefined;
  const h = height ? parseInt(height, 10) : undefined;
  
  // TypeScript enforces: format must be one of the union values
  if (format && !['jpeg', 'png', 'webp'].includes(format)) {
    res.status(400).json({ error: 'Invalid format' });
    return;
  }
  
  // ... resize logic
});
```

### What TypeScript catches:

| Scenario | JavaScript | TypeScript |
|----------|-----------|------------|
| `req.query.heigth` | Runtime `NaN` | **Compile error**: Property 'heigth' does not exist |
| Pass string to Sharp | Runtime error or bad output | **Compile error**: Type 'string' not assignable to 'number' |
| `format: "exe"` | Passed through to Sharp | **Compile error**: Type '"exe"' not assignable |
| Forget `mimetype` in metadata | Runtime `undefined` | **Compile error**: Property 'mimetype' is missing |

## The New PAIN: Unsafe Type Assertions

```typescript
const meta = uploads.get(id) as ImageMetadata;
// What if id doesn't exist? TypeScript believes it's non-null.
// Runtime: meta is undefined, meta.filename crashes
```

TypeScript trusts your type assertion. You need runtime checks too.

## The Realization

> Junior: "TypeScript caught that I was passing a string to `sharp.resize()` when it expects a number."
> 
> You: "Sharp's TypeScript definitions are excellent. They'll catch most misuse. But query params are the wild west — always parse and validate them explicitly."

## Why this matters for Image Resizer

Image processing has dangerous parameters:
- Negative dimensions crash Sharp
- Zero dimensions produce 1x1 images
- Unknown formats throw exceptions
- Huge dimensions allocate massive buffers

TypeScript catches the obvious mistakes at compile time. But users will send `"-500"`, `"0"`, `"99999"`. TypeScript won't stop those — but it ensures your handling code is type-safe.

## Next: v3 — Add Validation
