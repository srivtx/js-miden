# M30 Bulkhead — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl http://localhost:3000/critical?pool=background
curl http://localhost:3000/background?pool=critical
curl http://localhost:3000/unknown?pool=nonexistent
```

If the route logic doesn't validate the pool name, a misconfigured client can:
- Flood the critical pool from a background endpoint
- Trigger "Unknown pool" errors that crash the request handler
- Bypass intended workload isolation

## The Fix: Validate Pool Parameters

```ts
// validator.ts
export function validatePoolName(poolName: string): { valid: boolean; error?: string } {
  const validPools = ['critical', 'background', 'analytics'];
  if (!validPools.includes(poolName)) {
    return { valid: false, error: `Unknown pool: ${poolName}. Valid: ${validPools.join(', ')}` };
  }
  return { valid: true };
}

export function validateConcurrencyLimit(limit: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return { valid: false, error: 'Limit must be an integer between 1 and 1000' };
  }
  return { valid: true };
}
```

```ts
// index.ts
app.get('/critical', async (req: Request, res: Response) => {
  const validation = validatePoolName('critical');
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const result = await executeWithPool('critical', async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'critical', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});
```

**What this prevents:**
- Unknown pool names causing runtime crashes
- Misconfigured clients bypassing isolation
- Negative or absurdly high concurrency limits

## The Pain That Remains

You deploy to production. A user reports that critical requests are still being rejected during background job bursts. You check the logs — there are no logs. You can't tell which pool is full, when it filled, or whether it's a real problem or a brief spike.

## What v4 Fixes

Logging. Production without logs is flying blind.
