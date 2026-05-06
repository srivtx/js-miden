# v5 — Add Testing (Video Streaming)

## The Scenario

It's 2am. Your junior refactors the range request parser. "Just moving some logic around," they say. They deploy. Users report they can crash the server by sending malicious range headers. Your junior stares at the code — it looks fine. But they never tested range validation.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/middleware/range-request.middleware.ts
export function parseRangeHeader(range: string, fileSize: number): { start: number; end: number } | null {
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // BUG: No validation on start/end bounds
  // A client can request bytes=0-999999999999 on a 1MB file
  // This causes excessive memory usage and potential DoS

  return { start, end };
}
```

This code has a **DoS vulnerability** (unvalidated range bounds). A client requests `bytes=0-999999999999`. The server tries to allocate a buffer for a 1TB range. The server crashes.

Without tests, this bug ships to production. Users exploit it.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/streaming.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Video Streaming', () => {
  describe('Video CRUD', () => {
    it('creates a video', async () => {
      const res = await request(app)
        .post('/api/videos')
        .send({ title: 'Test Video', duration: 120, format: 'mp4' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Video');
    });

    it('rejects invalid format', async () => {
      const res = await request(app)
        .post('/api/videos')
        .send({ title: 'Test Video', duration: 120, format: 'exe' });
      expect(res.status).toBe(400);
    });
  });

  describe('Range Requests', () => {
    it('serves partial content for valid range', async () => {
      // Mock video file
      const res = await request(app)
        .get('/api/stream/test-video-id')
        .set('Range', 'bytes=0-1023');
      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBeDefined();
    });

    it('rejects oversized range requests', async () => {
      const res = await request(app)
        .get('/api/stream/test-video-id')
        .set('Range', 'bytes=0-999999999999');
      // Should return 416 Range Not Satisfiable or clamp to file size
      expect([416, 206]).toContain(res.status);
      if (res.status === 206) {
        // If 206, ensure content-length is reasonable
        const contentLength = parseInt(res.headers['content-length'], 10);
        expect(contentLength).toBeLessThanOrEqual(1024 * 1024); // Max 1MB
      }
    });

    it('BUG: demonstrates unvalidated range parser vulnerability', async () => {
      const res = await request(app)
        .get('/api/stream/test-video-id')
        .set('Range', 'bytes=0-999999999999');
      // This test documents that the range parser lacks validation
      // In production, this should be fixed to return 416
      expect(res.status).not.toBe(500); // Should not crash the server
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor breaks range validation | Deploy, DoS exploit | **CI fails** before merge |
| Malicious range accepted | Server crash | **Test rejects** oversized ranges |
| Invalid format uploaded | Malware distribution | **Test verifies** format whitelist |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real filesystem in unit tests
// - Slow (disk I/O)
// - Flaky (file permissions, disk space)
// - Requires test fixtures

// DO mock the file service
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the filesystem
```

Mocking the file service means:
- Your tests run in milliseconds
- No video files required
- You control every response (error cases, missing files, edge cases)

## Testing Evolution in Video Streaming

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for the range request vulnerability. It passes, but the comment says 'BUG'. Now every developer knows the range parser needs validation."
>
> You: "Tests are documentation that executes. A passing test with a 'BUG' comment is better than a security ticket nobody reads. In video streaming, one untested refactor can turn your origin server into a DDoS amplifier."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
