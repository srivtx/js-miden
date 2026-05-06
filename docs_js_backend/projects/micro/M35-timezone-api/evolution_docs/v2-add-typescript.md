# M35 Timezone API — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor v1 to use the `Date` object:

```js
app.get('/convert', (req, res) => {
  const { from, to, time } = req.query;
  const date = new Date(time);
  const converted = new Date(date.toLocaleString('en-US', { timeZone: to }));
  // BUG: toLocaleString returns a string, not a Date
  res.json({ convertedTime: converted.toISOString() });
});
```

**The bug:** `date.toLocaleString('en-US', { timeZone: to })` returns a string like `"7/1/2024, 8:00:00 AM"`. You wrap it in `new Date()` and hope for the best. It parses differently depending on the locale. TypeScript would flag the ambiguous string-to-Date conversion.

Another bug: you treat `req.query` values as always strings:

```js
const from = req.query.from;
const to = req.query.to;
```

If a client sends `?from=UTC&from=GMT`, `from` is an array. `offsets[from]` returns `undefined`. TypeScript would flag this.

## The Fix: Add TypeScript

```ts
// timezone.ts
export interface TimezoneConversion {
  from: string;
  to: string;
  originalTime: string;
  convertedTime: string;
  offset: string;
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { convertTime, listTimezones } from './timezone.js';

const app = express();

app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    res.status(400).json({ error: 'Missing required query parameters: from, to, time' });
    return;
  }

  try {
    const result = convertTime(String(from), String(to), String(time));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

Now `tsc` errors on:
```
index.ts:5:28 - error TS2345: Argument of type 'string | string[] | ParsedQs' is not assignable to parameter of type 'string'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A client can still send:
```
GET /convert?from=UTC&to=Mars/Space&time=2024-01-01
```
TypeScript sees strings, but at runtime `Mars/Space` is not a valid timezone. We need runtime validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because timezones are strings that must be verified.

## What v3 Fixes

Validation. Reject unsupported timezones before conversion.
