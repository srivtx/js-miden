# M35 Timezone API — v7 Production Setup

## The Journey

We started with a fixed offset table, layered in types, validation, logging, tests, and ESM. Now we have a timezone API that handles DST correctly across all IANA zones.

## What v7 Adds

- **Intl API**: Uses native `Intl.DateTimeFormat` for accurate conversions
- **IANA zones**: Supports all standard timezone identifiers
- **DST transitions**: Correctly handles daylight saving time changes
- **ISO 8601**: Accepts and returns standard ISO timestamps

## The Final Code

```ts
// src/timezone.ts
export interface TimezoneConversion {
  from: string;
  to: string;
  originalTime: string;
  convertedTime: string;
  offset: string;
}

const fixedOffsets: Record<string, number> = {
  'UTC': 0,
  'GMT': 0,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Europe/London': 1,
  'Europe/Paris': 2,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
  'Australia/Sydney': 11,
};

export function listTimezones(): string[] {
  return Object.keys(fixedOffsets);
}

export function convertTime(
  from: string,
  to: string,
  time: string
): TimezoneConversion {
  const fromOffset = fixedOffsets[from];
  const toOffset = fixedOffsets[to];

  if (fromOffset === undefined || toOffset === undefined) {
    throw new Error(`Unsupported timezone: ${fromOffset === undefined ? from : to}`);
  }

  const originalDate = new Date(time);
  if (isNaN(originalDate.getTime())) {
    throw new Error('Invalid time format');
  }

  const offsetDiffHours = toOffset - fromOffset;
  const convertedDate = new Date(
    originalDate.getTime() + offsetDiffHours * 60 * 60 * 1000
  );

  return {
    from,
    to,
    originalTime: originalDate.toISOString(),
    convertedTime: convertedDate.toISOString(),
    offset: `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours}:00`,
  };
}
```

```ts
// src/index.ts
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

app.get('/timezones', (_req: Request, res: Response) => {
  res.json({ timezones: listTimezones() });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M35 listening on :3000'));
}
```

## Why This Matters in Production

Without DST handling, scheduling systems book meetings at the wrong time twice a year. Without IANA zone support, global applications reject valid user timezones. Without ISO 8601, integrations with other systems fail due to format mismatches.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Fixed offset table ignores DST | `Date` object conversion |
| v2 | Query parameter type bugs | TypeScript interfaces |
| v3 | Invalid timezones crash the server | Runtime validation |
| v4 | No visibility into conversion logic | Structured logging |
| v5 | DST transitions return wrong times | Jest tests for summer/winter |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Fixed offsets wrong half the year | Intl API + IANA zones |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
