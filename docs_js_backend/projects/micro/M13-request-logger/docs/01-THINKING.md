# Thinking Process

## Mental Models

### The Request Lifecycle with Logging

```
┌─────────────────────────────────────────────────────────────┐
│  Timeline (milliseconds)                                    │
│                                                             │
│  0ms    5ms    10ms   15ms   20ms   25ms   30ms           │
│   │      │      │      │      │      │      │              │
│   ▼      ▼      ▼      ▼      ▼      ▼      ▼              │
│ ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐         │
│ │ Req ││ JSON││Route││ DB  ││res. ││finish││ Log │         │
│ │arrives│parse││runs ││query││json ││event ││writes│        │
│ └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘         │
│                                                             │
│  Logging happens AFTER "finish" so it never blocks          │
│  the response.                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sync vs Async Logging Flow

```
Synchronous Logging (console.log):
┌─────────────┐
│  Event Loop │
│             │
│  ┌───────┐  │
│  │ Log   │  │  <-- Blocks here until kernel buffer accepts
│  │ Write │  │      the data (usually fast, but NOT free)
│  └───────┘  │
│  ┌───────┐  │
│  │ Next  │  │  <-- Only runs after log write completes
│  │ Tick  │  │
│  └───────┘  │
└─────────────┘

Asynchronous Logging (pino with sync: false):
┌─────────────┐
│  Event Loop │
│             │
│  ┌───────┐  │
│  │ Log   │  │  <-- Immediately hands off to worker thread
│  │ Buffer│  │      or async stream. Event loop continues.
│  └───────┘  │
│  ┌───────┐  │
│  │ Next  │  │  <-- Runs immediately
│  │ Tick  │  │
│  └───────┘  │
└─────────────┘
```

## The Hot Path

What happens most often: a request arrives, the route processes it, the response is sent, and a log line is written. The log write must:
1. Not block the response (attach to `res.on('finish')`).
2. Include the correct status code (only known after the response finishes).
3. Redact sensitive fields before serialization.

## The Danger Zone

1. **Logging before the response finishes.** If you log at the start of the middleware, you don't know the status code yet. If the route crashes, you might not log at all.

2. **Synchronous logging under high load.** `console.log` writes to `process.stdout` synchronously. Under 10,000 req/s, this can block the event loop and degrade throughput by 30-50%.

3. **Sensitive data in logs.** A login request body contains `{ username: "admin", password: "secret" }`. If you log `req.body` directly, the password is now in plaintext in your logs. If logs are shipped to a third party, you've shared credentials with an external system.

4. **Log files growing forever.** Without rotation, a single misbehaving client can generate gigabytes of logs and fill the disk.

## Question Everything

- **Do we need a database?** No. Logging is append-only; we write to stdout or files.
- **Do we need Redis?** No. Log aggregation is a separate concern.
- **Do we need auth?** No. The logger runs on every request regardless of auth state.
- **Do we need real-time?** No. Logs are written synchronously or asynchronously, but not via WebSockets.

## The "What If" Game

- **What if 1000 users hit this at once?** Synchronous `console.log` can bottleneck. Async logging (pino, winston with async transports) scales better.
- **What if the database is down?** The logger still runs. It logs the failed request with a 500 status code.
- **What if a user sends a 10MB JSON body?** Logging the entire body would bloat logs. Consider truncating or omitting large bodies.
- **What if two users log in simultaneously?** Each request gets its own log line. There is no shared mutable state.
