# M29 Config Server — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -X POST http://localhost:3000/config/payments/prod \
  -d '{"dbHost":null,"port":"abc","timeout":-1,"retry":true}'
```

Your production app restarts, reads this config, and crashes:
- `null` dbHost → DNS lookup throws
- `"abc"` port → `parseInt` returns `NaN`, connection fails
- `-1` timeout → `setTimeout` throws RangeError

The config server stored poison. The app that consumed it died.

## The Fix: Validate Before Storing

```ts
// validator.ts
export function validateConfig(config: unknown): { valid: boolean; error?: string } {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, error: 'Config must be an object' };
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof key !== 'string' || key.length === 0) {
      return { valid: false, error: 'Keys must be non-empty strings' };
    }
    if (value === null || value === undefined) {
      return { valid: false, error: `Value for ${key} cannot be null or undefined` };
    }
  }

  return { valid: true };
}
```

```ts
// index.ts
app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;

  const validation = validateConfig(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  setConfig(appName, env, req.body);
  res.json({ status: 'ok', app: appName, env });
});
```

**What this prevents:**
- `null` values entering the store
- Non-object configs
- Empty keys

## The Pain That Remains

You deploy to production. A user reports that the payments service is using dev credentials. You have no idea when the config was changed or by whom. No logs. No visibility.

## What v4 Fixes

Logging. Production without logs is flying blind.
