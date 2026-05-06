# M18 Timezone API — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor the timezone API to support conversion:

```js
app.get('/convert', (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  const time = req.query.time;

  const result = convertTime(from, to, time);
  // Bug: req.query.from might be string[], undefined, or ParsedQs
  // convertTime expects strings. You just passed garbage.
});
```

Another bug: `convertTime` returns an object with `convertedTime: string`, but you treat it as a `Date` somewhere else. TypeScript would have caught this immediately.

## The Fix: Add TypeScript

```ts
// timezone.ts
export function isValidTimeZone(tz: string): boolean {
  return Intl.supportedValuesOf('timeZone').includes(tz);
}

export function getCurrentTime(timezone: string) {
  // ... returns { timezone, currentTime, offset, isDST }
}

export function convertTime(fromZone: string, toZone: string, timeString: string) {
  // ... returns { from, to, originalTime, convertedTime, offset }
}
```

```ts
// index.ts
app.get('/time/:timezone', (req: Request, res: Response) => {
  try {
    const zone = req.params.timezone;
    if (!isValidTimeZone(zone)) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }
    const result = getCurrentTime(zone);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/convert', (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const time = req.query.time as string;

    if (!from || !to || !time) {
      res.status(400).json({ error: 'Missing from, to, or time query parameter' });
      return;
    }

    if (!isValidTimeZone(from) || !isValidTimeZone(to)) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }

    const result = convertTime(from, to, time);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

**What TS catches:**
- `req.query.from` is `ParsedQs | string | string[]` — you must narrow it
- `isValidTimeZone` takes `string` — you can't pass `undefined` accidentally
- `getCurrentTime` and `convertTime` have explicit return types

## The Pain That Remains

TypeScript knows `timeString` is a `string`, but it doesn't know it's a valid ISO 8601 string. `convertTime('UTC', 'Tokyo', 'tomorrow at noon')` compiles fine. It crashes at runtime.

## What v3 Fixes

Validation. Reject invalid time formats before parsing.
