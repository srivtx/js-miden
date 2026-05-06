# M17 CSV Parser — v4 Add Logging

## The Bug: Production Visibility Crisis

Your CSV parser fails in production. Support tickets pour in:
- *"Upload gives 'CSV text is empty'"* — but the user swears they sent data
- *"Row count exceeds maximum"* — but they only uploaded 100 rows
- *"Missing required header: email"* — but their file has `email`

Without logs, you're debugging in the dark:

```ts
// Without logging — silent failures
app.post('/upload-csv', async (req, res) => {
  const csvText = req.body.csv || '';
  const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });
  res.json({ success: true, ...result });
});
```

You add `console.log` locally. It works. You deploy. It breaks again. Rinse and repeat.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.post('/upload-csv', async (req: Request, res: Response) => {
  try {
    const csvText = req.body.csv || '';
    const requiredHeaders = (req.body.requiredHeaders as string | undefined)
      ?.split(',')
      .filter(Boolean) || [];
    const maxRows = Number(req.body.maxRows) || 10000;

    logger.info({
      bodyLength: csvText.length,
      requiredHeaders,
      maxRows,
    }, 'CSV upload received');

    const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });

    logger.info({
      rowCount: result.rowCount,
      headers: result.headers,
    }, 'CSV parsed successfully');

    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error({ error: err.message }, 'CSV parsing failed');
    res.status(400).json({ success: false, error: err.message });
  }
});
```

Now logs tell the real story:
```json
{"level":"info","bodyLength":0,"requiredHeaders":["email"],"maxRows":10000,"msg":"CSV upload received"}
{"level":"error","error":"CSV text is empty","msg":"CSV parsing failed"}
```

**Ah.** The client sent JSON with `csvData` key instead of `csv`. You see it immediately.

Another scenario:
```json
{"level":"info","bodyLength":2500000,"maxRows":10000,"msg":"CSV upload received"}
{"level":"error","error":"Row count exceeds maximum allowed (10000)","msg":"CSV parsing failed"}
```

The user's 2.5MB file has 50,000 rows. Not a bug — a legitimate limit hit.

## The Pain That Remains

You fix the BOM handling and add support for tab-separated values. You accidentally break quoted field parsing. A user uploads:
```csv
name,description
Alice,"Software Engineer, Backend"
```

Your parser returns 3 columns. Your tests? None cover quoted commas.

## What v5 Fixes

Testing. Quoted fields, BOMs, injection — every edge case needs a test.
