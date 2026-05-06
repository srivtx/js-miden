# S02 Contact Form — Error Handling

## Validation Errors (400 Bad Request)

All validation failures return structured JSON so the frontend can display field-level errors:

```json
{
  "error": "Name must be between 2 and 100 characters"
}
```

**Why not 422?** Express conventionally uses 400 for malformed syntax or invalid parameters. 422 (Unprocessable Entity) is also valid but less universally supported by proxies.

## Rate Limit Errors (429 Too Many Requests)

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

The `Retry-After` header (in seconds) lets clients back off automatically. Browsers and HTTP libraries respect it.

## Redis Failure (Fail-Open)

When Redis is unreachable:
1. Error is logged to `stderr`.
2. `next()` is called, allowing the request.
3. No 500 is returned to the client.

**Why this matters**: A contact form is a marketing surface. If Redis dies during a product launch, you still want leads to come in.

## Global Error Handler

`src/middleware/errorHandler.ts` catches synchronous and async errors. For an endpoint with no database, the primary uncaught errors are:
- JSON parse errors (invalid body) — handled by Express `body-parser`.
- Unhandled promise rejections in middleware — caught by the error handler.

## Logging Strategy

Current: `console.log` / `console.error`

Production upgrade path:

| Tool | Structured? | Rotation? | GDPR Safe? |
|------|-------------|-----------|------------|
| `console` | No | No | Manual |
| `pino` | Yes (JSON) | Via `pino-rotate`) | Add redaction plugin |
| `winston` | Yes | Built-in | Add custom formatter |
| CloudWatch / Datadog | Yes | Automatic | Configure scrubber |

**Recommendation**: Switch to `pino` with a redaction list:
```ts
const logger = pino({ redact: { paths: ['email', 'name'], remove: true } });
```

This keeps logs useful for debugging volume while stripping PII.

## Graceful Shutdown

On `SIGTERM`, the server should:
1. Stop accepting new connections (`server.close()`).
2. Flush logs.
3. Disconnect from Redis (`redis.quit()`).

This prevents in-flight requests from being dropped.
