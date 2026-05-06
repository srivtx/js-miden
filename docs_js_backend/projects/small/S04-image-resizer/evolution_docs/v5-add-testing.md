# v5 — Add Testing (Image Resizer)

## The Scenario

It's 2am. Your junior updates Sharp to a new version. "It should be backward compatible," they say. They deploy. Users report "images are corrupted." Sharp changed the default output format. Without tests, you find out from user complaints.

## The PAIN: Image Processing Is Brittle

From v4:

```typescript
const resized = await pipeline.toBuffer();
res.set('Content-Type', `image/${format === 'jpg' ? 'jpeg' : format}`);
res.send(resized);
```

Sharp version changes can alter:
- Default compression
- Color space handling
- Metadata stripping
- Output format behavior

Without tests, image corruption is invisible until a user downloads a broken file.

## The Solution: Vitest + Supertest + Binary Assertions

```typescript
// tests/resize.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = './uploads';

async function ensureFixtures() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  // Create a 1x1 red png buffer
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  await writeFile(join(UPLOAD_DIR, 'test.png'), png);
}

describe('S04 Image Resizer', () => {
  it('uploads an image', async () => {
    await ensureFixtures();
    const res = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it('resizes an image', async () => {
    await ensureFixtures();
    const uploadRes = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    const id = uploadRes.body.id;
    
    const res = await request(app).get(`/resize/${id}?width=10&height=10`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image/);
    // Verify it's actually a valid image by checking magic bytes
    expect(res.body[0]).toBe(0x89); // PNG magic byte
    expect(res.body[1]).toBe(0x50); // PNG magic byte
  });

  it('converts format to webp', async () => {
    await ensureFixtures();
    const uploadRes = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    const id = uploadRes.body.id;
    
    const res = await request(app).get(`/resize/${id}?format=webp`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
  });

  it('rejects invalid dimensions', async () => {
    await ensureFixtures();
    const uploadRes = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    const id = uploadRes.body.id;
    
    const res = await request(app).get(`/resize/${id}?width=-100`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing image', async () => {
    const res = await request(app).get('/resize/nonexistent?width=10');
    expect(res.status).toBe(404);
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Sharp upgrade breaks output | Users see corrupted images | **Test checks** magic bytes |
| Format conversion broken | Wrong content-type sent | **Test verifies** `image/webp` |
| Validation bypass | Server crashes on bad input | **Test rejects** negative dimensions |
| Missing image handling | 500 instead of 404 | **Test expects** 404 |
| Memory leak on resize | OOM in production | **Test verifies** response completes |

## The PAIN of Binary Testing

```typescript
// Text APIs are easy:
expect(res.body.name).toBe('Test');

// Binary APIs need more care:
expect(res.body[0]).toBe(0x89); // PNG signature
expect(res.body[1]).toBe(0x50); // 'P'
expect(res.body[2]).toBe(0x4E); // 'N'
expect(res.body[3]).toBe(0x47); // 'G'
```

Image tests should verify:
- HTTP status
- Content-Type header
- Magic bytes (file format signature)
- Dimensions (if testable via metadata)

## Testing Evolution in Image Resizer

| Version | Testing | Image confidence |
|---------|---------|-----------------|
| v1 (JS) | Visual inspection | Zero |
| v2-4 | Still manual | Zero |
| v5 (Vitest) | Upload, resize, format, error tested | High |

## The Realization

> Junior: "I added a test that checks the PNG magic bytes after resize. When Sharp updated, the test caught that WebP output was being sent with a PNG content-type."
> 
> You: "Binary data is unforgiving. A wrong content-type or corrupt header breaks clients in ways that are hard to debug. Tests for image APIs must verify bytes, not just status codes."

## The Next PAIN

Tests pass locally. CI fails with `ERR_REQUIRE_ESM`. Your test file uses `require('supertest')` but your source uses `import`. The module system mismatch strikes again.

## Next: v6 — Switch to ESM
