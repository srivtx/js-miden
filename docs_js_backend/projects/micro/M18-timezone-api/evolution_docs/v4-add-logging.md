# M18 Timezone API — v4 Add Logging

## The Bug: Production Visibility Crisis

Your timezone API works... mostly. Support tickets:
- *"DST is wrong for Sydney"* — but it looks right in your test
- *"Convert endpoint returns 400 but my time looks valid"* — you can't reproduce
- *"Time for Africa/Cairo is off by an hour"* — Egypt abolished DST in 2023

Without logs:
```ts
app.get('/convert', (req, res) => {
  const result = convertTime(from, to, time);
  res.json(result); // No trace of what happened
});
```

You add `console.log` locally. It works. You deploy. The bug is environment-specific because your server is in a different timezone than your laptop. You need production logs.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.get('/time/:timezone', (req: Request, res: Response) => {
  const zone = req.params.timezone;
  logger.info({ zone }, 'Time request received');

  if (!isValidTimeZone(zone)) {
    logger.warn({ zone }, 'Invalid timezone requested');
    res.status(400).json({ error: 'Invalid timezone' });
    return;
  }

  const result = getCurrentTime(zone);
  logger.info({ zone, result }, 'Time computed');
  res.json(result);
});

app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;
  logger.info({ from, to, time }, 'Convert request received');

  try {
    const result = convertTime(from as string, to as string, time as string);
    logger.info({ from, to, result }, 'Time converted');
    res.json(result);
  } catch (err: any) {
    logger.error({ from, to, time, error: err.message }, 'Conversion failed');
    res.status(400).json({ error: err.message });
  }
});
```

Now logs reveal the truth:
```json
{"level":"info","zone":"Africa/Cairo","result":{"offset":"+02:00","isDST":false},"msg":"Time computed"}
```

**Ah.** Egypt abolished DST in 2023. The IANA database (via `Intl`) knows this. Your old manual offset table didn't. The log confirms `isDST: false` and `+02:00` year-round.

Another scenario:
```json
{"level":"error","from":"UTC","to":"Asia/Tokyo","time":"2024-06-15","error":"Time must be in ISO 8601 format","msg":"Conversion failed"}
```

The user sent `2024-06-15` (date only) instead of `2024-06-15T00:00:00Z`. The log makes it obvious.

## The Pain That Remains

You update DST detection logic. You accidentally break the January offset calculation. Now `isDST` is always `true`. Your tests? None verify DST for specific dates.

## What v5 Fixes

Testing. Every timezone edge case needs a test.
