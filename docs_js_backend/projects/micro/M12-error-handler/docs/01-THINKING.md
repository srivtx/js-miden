# Thinking Process

## Mental Models

### The Error Propagation Chain

```
┌─────────────┐
│   Client    │
│   Request   │
└──────┬──────┘
       │
       ▼
┌──────────────┐     Error      ┌─────────────────┐
│   Route      │───────────────►│  Express catches │
│   Handler    │   (thrown or   │  and forwards to │
│              │    next(err))  │  error handler   │
└──────────────┘                └────────┬────────┘
                                         │
                                         ▼
                              ┌────────────────────┐
                              │  Error Handler      │
                              │  (4-arity fn)       │
                              │  err, req, res, next│
                              └────────┬───────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │ headersSent │   │   AppError  │   │  Unknown    │
            │   === true  │   │  instance   │   │   Error     │
            └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                   │                 │                 │
                   ▼                 ▼                 ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │ Log & abort │   │ Use err.    │   │ status: 500 │
            │ (do NOT     │   │ status/title│   │ title:      │
            │  touch res) │   │             │   │ Internal    │
            └─────────────┘   └─────────────┘   │ Server Error│
                                                └─────────────┘
```

## The Hot Path

What happens most often: a client sends invalid input (e.g., `a: "foo"` instead of a number). The route throws an `AppError(400, ...)` and the error handler formats it into an RFC 7807 response. This path must be:
1. Fast (<5ms)
2. Safe (never crashes)
3. Informative (tells the client what went wrong)

## The Danger Zone

1. **Stack trace leakage in production.** An attacker probes your API with garbage input. The 400 response contains `stack: "Error: ... at /app/src/routes.ts:15:..."`. The attacker now knows your file paths, that you use TypeScript, and that your app lives in `/app/src/`.

2. **Double-response crash.** A route sends a 200 response, then a cleanup task throws. The error handler calls `res.status(500).json(...)` but headers are already sent. Node.js throws `ERR_HTTP_HEADERS_SENT` and the process crashes. In a containerized environment, Kubernetes restarts the pod. The user sees a 502 Bad Gateway.

3. **Swallowed async errors.** Before Express 5, an unhandled rejection in an async route handler crashed the process because Express did not catch it. Express 5 catches it automatically, but many codebases still use wrapper functions out of habit.

## Question Everything

- **Do we need a database?** No. Error handling is in-memory formatting.
- **Do we need Redis?** No. Error state is per-request.
- **Do we need auth?** No. Error responses are the same for everyone.
- **Do we need real-time?** No. Error responses are synchronous.

## The "What If" Game

- **What if 1000 users hit invalid endpoints at once?** The error handler is stateless and O(1). It scales linearly with Express.
- **What if the database is down?** The error handler catches the connection error and returns 503. The server stays up.
- **What if a user sends garbage?** The error handler catches validation errors and returns 400 with a clear message.
- **What if two users trigger the same bug?** Each gets their own error response. There is no shared mutable state.
