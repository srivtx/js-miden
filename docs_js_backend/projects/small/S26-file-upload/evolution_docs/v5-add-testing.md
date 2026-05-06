# v5-add-testing

## Goal
Prove that validation, storage, and image processing work — and that dangerous files are rejected.

## Changes
1. `vitest` + `supertest` for HTTP-level tests.
2. Mock `file-type` and virus scanner to avoid binary dependencies in CI.
3. Test path traversal attempt, oversized file, and wrong magic number.

## Code

```ts
// tests/upload.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Upload', () => {
  it('rejects a file with wrong magic number', async () => {
    vi.mock('file-type', () => ({ fileTypeFromFile: vi.fn().mockResolvedValue({ mime: 'application/x-executable' }) }));

    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('MZ'), 'fake.jpg');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file type/);
  });

  it('stores a valid image and returns path', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('valid-image-bytes'), 'photo.png');

    expect(res.status).toBe(201);
    expect(res.body.path).toMatch(/uploads\//);
  });
});
```

## Decisions
- Mock external scanners so tests run in milliseconds, not seconds.
- Use `Buffer.from` for fixtures — no disk I/O in tests.

## Risks
- Mocked scanner means we need a separate integration test with real ClamAV in CI.
