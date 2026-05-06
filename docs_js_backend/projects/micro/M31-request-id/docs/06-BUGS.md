# M31: Intentional Bug

## Location
`src/index.ts` error handler and `src/proxy.ts` catch blocks.

## Symptoms
- 500 error responses do not include `X-Request-ID` header
- Logs from error handlers show the request ID, but the client cannot correlate
- Downstream services receive request IDs, but the final response to the client lacks them

## Reproduction
```ts
// Trigger an error in /data
const res = await request(app).get('/data');
// res.headers['x-request-id'] is undefined
```

## Root Cause
The error handler does not re-set or guarantee `X-Request-ID` on the response:
```ts
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message }); // Missing header
});
```

## Fix
```ts
app.use((err, req, res, next) => {
  const requestId = getRequestId(req);
  if (!res.headersSent) {
    res.setHeader('X-Request-ID', requestId);
  }
  res.status(500).json({ error: err.message });
});
```

## Real-World Impact
When a mobile app receives a 500 error, support teams cannot trace the corresponding server logs without the request ID. This turns 5-minute debug sessions into multi-hour investigations.
