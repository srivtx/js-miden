# M33 UUID Service — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -X POST http://localhost:3000/uuid/bulk -d '{"count": -1, "type": "v8"}'
curl -X POST http://localhost:3000/uuid/bulk -d '{"count": 1000000, "type": "v4"}'
curl -X POST http://localhost:3000/uuid/bulk -d '{"count": "abc", "type": null}'
```

Your server:
- Generates a million UUIDs and OOMs
- Tries to call `uuidV8()` which doesn't exist → `undefined` in results
- Parses `"abc"` as `NaN`, falls back to 1, but logs show confusing data

## The Fix: Validate Bulk Requests

```ts
// validator.ts
export function validateBulkRequest(body: unknown): { valid: boolean; error?: string; data?: { count: number; type: 'v4' | 'v7' | 'ulid' } } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Body must be an object' };
  }

  const { count, type } = body as any;

  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    return { valid: false, error: 'count must be an integer between 1 and 1000' };
  }

  const validTypes = ['v4', 'v7', 'ulid'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }

  return { valid: true, data: { count: n, type } };
}
```

```ts
// index.ts
app.post('/uuid/bulk', (req: Request, res: Response) => {
  const validation = validateBulkRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { count, type } = validation.data!;
  const results = bulkGenerate(count, type);
  res.json({ count, type, results });
});
```

**What this prevents:**
- Negative counts
- Absurd bulk sizes
- Unknown UUID types
- Non-integer counts

## The Pain That Remains

You deploy to production. A user reports that UUID v7 timestamps are wrong. You check the code — it looks correct. You have no logs showing when v7 was generated or what the expected vs actual timestamps were.

## What v4 Fixes

Logging. Production without logs is flying blind.
