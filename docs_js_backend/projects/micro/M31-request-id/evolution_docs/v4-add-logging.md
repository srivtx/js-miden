# M31 Request ID — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"My request failed at 14:23."*

You check the logs. You have thousands of `console.log` lines with no structure:

```
health check
fetching data
health check
error: something broke
fetching data
health check
```

You can't search by request ID. You can't filter by user. You can't correlate the error with the specific request. The request ID exists in memory, but it's never logged.

```ts
// Without logging — the ID exists but is invisible
app.get('/data', async (req, res) => {
  const id = getRequestId(req); // exists, but never logged
  console.log('fetching data');
  res.json({ data: [1, 2, 3] });
});
```

## The Fix: Structured Logging

```ts
// logger.ts
export interface LogEntry {
  timestamp: string;
  level: string;
  requestId: string;
  message: string;
  meta?: Record<string, unknown>;
}

export function logWithRequestId(
  req: Request,
  level: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: getRequestId(req),
    message,
    meta,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'INFO', message, meta),
  error: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'ERROR', message, meta),
};
```

```ts
// index.ts
app.get('/health', (req: Request, res: Response) => {
  logger.info(req, 'health check');
  res.json({ status: 'ok' });
});

app.get('/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(req, 'fetching data');
    res.json({ data: [1, 2, 3] });
  } catch (err) {
    logger.error(req, 'data error');
    next(err);
  }
});
```

Now your logs tell the story:
```json
{"timestamp":"2024-01-01T14:23:07.123Z","level":"INFO","requestId":"550e8400-e29b-41d4-a716-446655440000","message":"health check"}
{"timestamp":"2024-01-01T14:23:07.456Z","level":"ERROR","requestId":"550e8400-e29b-41d4-a716-446655440000","message":"data error"}
```

## The Pain That Remains

You add error handling. In the process, you forget to set `X-Request-ID` on error responses:

```ts
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message }); // no X-Request-ID header
});
```

Users get a 500 but can't tell you which request failed. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
