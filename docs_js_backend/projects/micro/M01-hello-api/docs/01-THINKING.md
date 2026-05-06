# 01 — THINKING: Mental Models for a Logging API

## The Hot Path

Every request follows this exact pipeline. Know it cold.

```
Client          Express              Middleware           Handler           Client
  │                │                     │                  │                │
  │ ──GET /─────> │                     │                  │                │
  │                │ ──create req/res──> │                  │                │
  │                │                     │                  │                │
  │                │ <──next()────────── │                  │                │
  │                │                     │                  │                │
  │                │ ──route match───────────────────────>  │                │
  │                │                                          │ send('Hello') │
  │                │ <─────────────────────────────────────── │               │
  │                │                     │                  │                │
  │                │ ──res.on('finish')─>│                  │                │
  │                │                     │ compute duration │                │
  │                │                     │ write JSON log   │                │
  │ <────────────── │                     │                  │                │
  │   200 OK        │                     │                  │                │
```

**The hot path is: request → middleware → handler → finish event → log → response.**

Any delay in this chain delays the client. The logger must not block.

## Mental Model 1: The Event Loop is a Single Thread

Node.js runs your code on one thread. If that thread is busy, no other request gets handled.

```
WRONG mental model:
  "Logging is I/O, so it's async and free."

RIGHT mental model:
  "console.log is SYNCHRONOUS file descriptor write.
   It blocks the event loop until the kernel buffer accepts the data.
   Under 10k req/s, this destroys throughput."
```

This is why we use **Pino**. Pino writes to `stdout` using the fastest possible serialization and offloads formatting to a separate worker thread when configured with `pino.destination()`. Even in its default mode, it uses `JSON.stringify` directly instead of expensive interpolation.

## Mental Model 2: Middleware is a Stack of Functions

Express middleware is not magic. It is an array of functions that `next()` calls the next one.

```
app.use(mw1)
app.use(mw2)
app.get('/', handler)

Call stack during a request:
  mw1(req, res, next) {
    // do stuff
    next()  → calls mw2
  }
  mw2(req, res, next) {
    // do stuff
    next()  → calls handler
  }
  handler(req, res) {
    res.send('Hello')
    // no next() — chain ends, response flows back out
  }
```

**Danger zone:** If you forget `next()` in a middleware that isn't a terminal handler, the request hangs forever. The client waits until timeout.

## Mental Model 3: `res.on('finish')` is the Only Reliable Timing Hook

Express does not have a "post-response" middleware. The response object is a Node.js `http.ServerResponse`, which is an `EventEmitter`. It emits `'finish'` when the last byte is written to the socket.

```
Start timer here ──>│
                    │    Handler runs
                    │    res.send()
                    │         │
                    │         ▼
                    │    Headers sent
                    │    Body written
                    │         │
                    │         ▼
                    │    'finish' event fires  <── Stop timer here
                    │         │
                    │         ▼
                    │    Log duration
```

If you stop the timer when `res.send()` returns, you miss the actual network I/O time. For small payloads the difference is tiny, but for large JSON responses or slow clients, it matters.

## Question Everything

### Q: Why not log inside the route handler?

Because then EVERY route must remember to log. That's a guarantee you will forget. Middleware catches all routes automatically.

### Q: Why include a `requestId`?

In a microservices architecture, one user action triggers 5–10 internal API calls. If each service logs the same `requestId`, you can grep (or query) one UUID and see the entire journey. Without it, you're connecting timestamps across services like a detective with a corkboard and string.

### Q: What if the client disconnects before `'finish'`?

The `'finish'` event still fires when the response stream closes. But if the socket is destroyed very early, you might get `'close'` instead of `'finish'`. For production robustness, some loggers listen to both events. In this micro-project, we keep it simple with just `'finish'`.

### Q: What if the handler throws synchronously?

Express catches synchronous throws in route handlers and passes them to error-handling middleware. But it does NOT catch throws in async handlers unless you use `express-async-errors` or wrap in `try/catch`. Our simple handlers are synchronous, so we're safe. In a real app, you'd add an error-handling middleware at the bottom of the stack.

## The What-If Game

### What if we get 10,000 requests per second?

- `console.log` → event loop blocked → latency spikes → cascading failures → outage.
- Pino → writes to `stdout` buffer, kernel handles backpressure, Node event loop stays free.

### What if we deploy to Kubernetes?

- Logs must go to `stdout`/`stderr`. Kubernetes captures these and forwards to its logging backend.
- Writing to files inside a container is an anti-pattern: containers are ephemeral, the disk disappears when the pod restarts.
- Our choice of stdout-only logging is correct for K8s.

### What if we need to trace a request across 5 microservices?

- Service A generates `requestId` and puts it in an HTTP header: `X-Request-Id: abc-123`.
- Service B reads the header, uses the same `requestId` in its logs.
- All 5 services log the same UUID. In Datadog, you filter `requestId:abc-123` and see the entire distributed trace.

### What if someone sends a 100MB payload?

- Our app has no body parser configured, so Express ignores the body. Good.
- If we added `express.json()`, we'd need a `limit` option to prevent memory exhaustion.
- This is out of scope but is exactly the kind of question a senior engineer asks.

### What if the log format changes?

- Structured JSON means adding a field is backward-compatible for parsers.
- Changing `durationMs` to `duration_ms` breaks every dashboard query. Naming conventions matter.
- Pino uses camelCase by default; we follow that convention.
