# M35 Timezone API — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts any timezone:

```bash
curl "http://localhost:3000/convert?from=UTC&to=Mars/Space&time=2024-01-01T00:00:00Z"
curl "http://localhost:3000/convert?from=UTC&to=&time=2024-01-01"
curl "http://localhost:3000/convert?from=UTC&to=Asia/Tokyo&time=not-a-date"
```

Your server:
- Looks up `Mars/Space` in the offset table → `undefined` → throws "Unsupported timezone"
- Looks up empty string → `undefined` → throws
- Parses `not-a-date` → `NaN` → returns `Invalid Date`

The errors are unhelpful. The status codes are inconsistent.

## The Fix: Validate Timezones and Dates

```ts
// validator.ts
export function validateTimezone(tz: string): { valid: boolean; error?: string } {
  if (!tz || tz.trim().length === 0) {
    return { valid: false, error: 'Timezone is required' };
  }
  if (!tz.includes('/')) {
    return { valid: false, error: `Invalid timezone format: ${tz}` };
  }
  return { valid: true };
}

export function validateISOTime(time: string): { valid: boolean; error?: string } {
  const date = new Date(time);
  if (isNaN(date.getTime())) {
    return { valid: false, error: `Invalid time format: ${time}` };
  }
  return { valid: true };
}
```

```ts
// index.ts
app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    return res.status(400).json({ error: 'Missing required query parameters: from, to, time' });
  }

  const fromValidation = validateTimezone(String(from));
  if (!fromValidation.valid) {
    return res.status(400).json({ error: fromValidation.error });
  }

  const toValidation = validateTimezone(String(to));
  if (!toValidation.valid) {
    return res.status(400).json({ error: toValidation.error });
  }

  const timeValidation = validateISOTime(String(time));
  if (!timeValidation.valid) {
    return res.status(400).json({ error: timeValidation.error });
  }

  try {
    const result = convertTime(String(from), String(to), String(time));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

**What this prevents:**
- Empty timezones
- Invalid timezone formats
- Non-ISO timestamps

## The Pain That Remains

You deploy to production. A user reports that `America/New_York` conversions are wrong in July. You check the code — the offset table says -5. It should be -4 for DST. You have no logs showing what offset was used or whether DST was considered.

## What v4 Fixes

Logging. Production without logs is flying blind.
