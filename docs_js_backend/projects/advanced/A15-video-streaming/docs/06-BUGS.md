# Bug Analysis

## Bug: Missing Range Request Validation

### Location
- `src/utils/range.utils.ts` - `parseRange()`
- `src/middleware/range-request.middleware.ts` - attaches range without size validation
- `src/services/stream.service.ts` - creates read stream with unvalidated range

### Description
The `parseRange` function parses the `Range: bytes=start-end` header but does not validate:
1. That `start` and `end` are non-negative integers
2. That `start <= end`
3. That `end` does not exceed the actual file size
4. That the requested range size is within acceptable limits

### Impact
- **DoS**: Client can request `bytes=0-999999999` on a 10KB file. The server sets `Content-Range` accordingly and Node.js `createReadStream` may read beyond EOF or allocate buffers based on the range.
- **Memory Exhaustion**: A malicious client can request the maximum possible range, causing the server to attempt loading huge chunks into memory.
- **Information Leak**: Negative or malformed ranges may expose internal errors.

### Reproduction
```typescript
// Test: stream.range.test.ts
const res = await request(app)
  .get(`/streams/video/${testVideoId}`)
  .set('Range', 'bytes=0-999999999');

expect(res.status).toBe(206); // BUG: Should be 416 Range Not Satisfiable
```

### Fix Strategy
```typescript
export function parseRange(rangeHeader: string, fileSize: number): Range | null {
  // ... parse logic ...
  if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
    return null; // Will result in 416 response
  }
  const maxChunk = 1024 * 1024; // 1MB limit
  if (end - start + 1 > maxChunk) {
    end = start + maxChunk - 1;
  }
  return { start, end };
}
```
