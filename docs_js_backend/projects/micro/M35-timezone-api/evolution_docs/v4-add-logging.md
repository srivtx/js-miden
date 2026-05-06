# M35 Timezone API — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"My 12:00 UTC conversion to New York returned 07:00 instead of 08:00."*

You check the code. The offset table says -5. You have zero visibility into:

- What offset was applied?
- Was DST considered?
- What was the input date?
- What was the expected vs actual output?

```ts
// Without logging — silent wrong answer
app.get('/convert', (req, res) => {
  const result = convertTime(from, to, time);
  res.json(result); // Wrong answer, no trace
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;
  const requestId = getRequestId(req);

  logger.info({ requestId, from, to, time }, 'Timezone conversion requested');

  try {
    const result = convertTime(String(from), String(to), String(time));
    logger.info({ requestId, result }, 'Timezone conversion completed');
    res.json(result);
  } catch (err: any) {
    logger.error({ requestId, error: err.message }, 'Timezone conversion failed');
    res.status(400).json({ error: err.message });
  }
});
```

```ts
// timezone.ts
export function convertTime(from: string, to: string, time: string): TimezoneConversion {
  const fromOffset = fixedOffsets[from];
  const toOffset = fixedOffsets[to];

  logger.debug({ from, to, fromOffset, toOffset }, 'Using fixed offsets');

  const offsetDiffHours = toOffset - fromOffset;
  const originalDate = new Date(time);
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

Now your logs tell the story:
```json
{"level":"info","requestId":"abc","from":"UTC","to":"America/New_York","time":"2024-07-01T12:00:00Z","msg":"Timezone conversion requested"}
{"level":"debug","requestId":"abc","fromOffset":0,"toOffset":-5,"msg":"Using fixed offsets"}
{"level":"info","requestId":"abc","convertedTime":"2024-07-01T07:00:00.000Z","msg":"Timezone conversion completed"}
```

The log shows `-5` was used for July. It should be `-4`. The bug is obvious in the logs.

## The Pain That Remains

You switch to the `Intl.DateTimeFormat` API to handle DST. In the process, you break the offset calculation:

```ts
// BEFORE
const offsetDiffHours = toOffset - fromOffset;

// AFTER — "better" but WRONG
const converted = new Date(originalDate.toLocaleString('en-US', { timeZone: to }));
```

Now the conversion ignores the `from` timezone entirely. `from=Asia/Tokyo` to `to=UTC` returns the same time. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
