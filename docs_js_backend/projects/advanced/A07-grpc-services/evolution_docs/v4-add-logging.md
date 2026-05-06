# A07 Evolution: v4 — Add Logging

## State of the System

Every gRPC call and REST gateway request is logged as structured JSON. Logs include trace IDs, deadlines, and status codes. Errors are classified and counted.

## What Changed

- **Structured JSON logger.** `logInfo()` and `logError()` output single-line JSON with `level`, `message`, `timestamp`, and metadata.
- **Gateway request logging.** Each route logs the inbound HTTP method, path, and body summary before translating to gRPC.
- **gRPC error classification.** `NOT_FOUND` → `metrics.increment('rpc.not_found')`. `DEADLINE_EXCEEDED` → `metrics.increment('rpc.deadline_exceeded')`. `UNAVAILABLE` → `metrics.increment('rpc.unavailable')`.
- **Deadline tracking.** Gateway routes compute `deadline = new Date(Date.now() + 5000)` and log whether the call completed before or after the deadline.

## What Still Breaks

- **No deadlines on clients.** The `userClient` and `orderClient` are still created without timeout configuration. The gateway computes a deadline but does not pass it to the gRPC call.
- **No retry logic.** A `UNAVAILABLE` error is logged and returned to the client. There is no automatic retry with exponential backoff.
- **Proto mismatch is logged but not fixed.** The gateway logs `order_v1.proto loaded`, but the Order Service logs `order.proto loaded`. The mismatch is visible in logs, but the system still corrupts data.
- **No distributed tracing.** The gateway generates a `requestId`, but it is not injected into gRPC metadata. Downstream services cannot correlate their logs with the gateway request.

## Code Snapshot (gateway/routes/users.ts)

```typescript
router.get('/:id', (req, res) => {
  const deadline = new Date(Date.now() + 5000);
  logInfo('Gateway request', { method: 'GET', path: req.path, requestId: req.headers['x-request-id'] });
  userClient.getUser({ id: req.params.id }, { deadline }, (err, user) => {
    if (err) {
      logError('gRPC error', err, { code: err.code, requestId: req.headers['x-request-id'] });
      if (err.code === grpc.status.NOT_FOUND) return res.status(404).json({ error: 'NOT_FOUND' });
      if (err.code === grpc.status.DEADLINE_EXCEEDED) return res.status(504).json({ error: 'TIMEOUT' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: user });
  });
});
```

## Architectural Notes

This is the "deadlines + streaming" stage. The system now tracks how long each gRPC call takes and classifies failures by status code. Streaming RPCs (`ListUsers`, `ListUserOrders`) are logged per-record. However, deadlines are computed but not enforced, and retries are discussed in documentation but not implemented.

## Migration Path to v5

1. Add Vitest tests for deadline enforcement and retry behavior.
2. Inject `x-request-id` into gRPC metadata and propagate it to all services.
3. Implement exponential backoff retry via `grpc.service_config`.
