# 00 — PROBLEM: Hello API with Logging

## What We're Building

A single HTTP API endpoint—`GET /`—that returns the string `Hello, World!`, plus a `GET /health` endpoint that returns `{"status": "ok"}`. That's it. Two routes.

But that's only half the story. The real product here is **observability**. Every request that hits this server must leave behind a structured JSON log entry containing:

- `timestamp` — ISO 8601 string of when the request arrived
- `method` — HTTP verb (`GET`, `POST`, etc.)
- `path` — URL path (`/`, `/health`)
- `statusCode` — HTTP response status (`200`, `404`, `500`)
- `durationMs` — wall-clock time from request arrival to response fully sent
- `requestId` — a UUID that uniquely identifies this single request

The logs must be **machine-readable JSON**, not human-readable strings, so that log aggregation platforms (Datadog, Grafana Loki, Splunk, AWS CloudWatch) can index, filter, and alert on them without brittle regex parsing.

## Why It Exists

In production, "it works" is not enough. You need to know:

1. **Is it up?** → Health check answers this.
2. **Is it fast?** → `durationMs` answers this.
3. **Is it failing?** → `statusCode` answers this.
4. **Which request broke?** → `requestId` lets you trace a single request across multiple services.

This micro-project teaches the foundational skill of **structured logging**—the single most important operational practice in backend development after "make it respond at all."

## Constraints

| Constraint | Rationale |
|------------|-----------|
| TypeScript + ESM | Modern Node.js; compile-time safety; tree-shaking |
| Express 5 | Most widely understood HTTP framework; stable |
| Pino for logging | Fastest structured logger in the Node ecosystem |
| Vitest for testing | Native ESM support; fast feedback loop |
| No database | Scope boundary; this is about HTTP + logging only |
| No auth | Scope boundary; auth is a separate micro-project |
| No Docker | Scope boundary; containerization is a separate topic |

## Scope Boundaries

```
IN SCOPE:
  ✓ HTTP request/response lifecycle
  ✓ Middleware injection
  ✓ Structured JSON logging
  ✓ Response timing measurement
  ✓ Graceful shutdown on SIGTERM
  ✓ Unit tests with in-memory log capture

OUT OF SCOPE:
  ✗ Authentication / authorization
  ✗ Database persistence
  ✗ External API calls
  ✗ Rate limiting
  ✗ Request/response compression
  ✗ TLS/HTTPS termination (handled by reverse proxy in production)
  ✗ Horizontal scaling / load balancing
  ✗ Metrics other than request duration
```

## The Real-World Context

This is not a toy. Every production service you will ever build needs exactly these three things:

1. A way to receive HTTP requests (Express, Fastify, Hono, etc.)
2. A way to log what happened (Pino, Winston, Bunyan)
3. A way to verify it still works (automated tests)

Master this pattern and you have the skeleton of every microservice, API gateway, and webhook handler in existence.
