# Webhooks: Push vs Pull

## WHAT

- **Pull (Polling):** The client repeatedly asks the server for new data.
- **Push (Webhooks):** The server sends data to the client when an event occurs.

Webhooks are HTTP callbacks: the provider makes a `POST` request to a URL you control.

## WHY

Polling creates unnecessary load and latency. Consider a GitHub integration polling every minute:

- 1,440 requests/day per repository.
- Average latency: 30 seconds (half the polling interval).
- Rate limit exhaustion on large-scale integrations.

Webhooks solve this by delivering events in milliseconds, but they shift complexity to the receiver:

- You must expose a public HTTPS endpoint.
- You must handle retries, idempotency, and signature verification.
- You must absorb traffic spikes (e.g., GitHub `push` events on a monorepo).

## HOW

**Hybrid model (Pull as backup):**

```
┌─────────────┐     Webhook (push)     ┌──────────────┐
│   GitHub    │ ──────────────────────> │  Receiver    │
│  (Provider) │                         │  (Your API)  │
└─────────────┘                         └──────────────┘
       │                                        │
       │     Periodic sync (pull backup)        │
       └───────────────────────────────────────>│
```

Use webhooks for real-time updates and a periodic full sync to recover from missed events.

**Implementation checklist:**

- [ ] Expose `POST /webhooks/:provider` behind HTTPS.
- [ ] Validate signatures (HMAC or RSA).
- [ ] Acknowledge with `200 OK` quickly.
- [ ] Queue payload for asynchronous processing.
- [ ] Log and monitor delivery failures.

## WRONG vs RIGHT

### WRONG: Synchronous Heavy Processing

```javascript
// BAD: HTTP handler does everything; provider times out and retries
app.post("/webhooks", async (req, res) => {
  await processPayment(req.body);          // 5 seconds
  await sendEmail(req.body.customerEmail); // 2 seconds
  await updateCRM(req.body);               // 3 seconds
  res.sendStatus(200); // Provider may have already retried!
});
```

### RIGHT: Acknowledge + Async Process

```javascript
// GOOD: Return 200 immediately, queue the work
app.post("/webhooks", async (req, res) => {
  const isValid = verifySignature(req);
  if (!isValid) return res.sendStatus(401);

  await eventQueue.add("process-webhook", {
    id: req.headers["x-event-id"],
    payload: req.body,
  });
  res.sendStatus(200);
});

// Worker (background job)
worker.on("job", async (job) => {
  await processPayment(job.data.payload);
  await sendEmail(job.data.payload.customerEmail);
});
```

## Timeline: Race Condition in Push+Pull Hybrid

```
Time ──────────────────────────────────────────────────>

Client: ──[Poll t=0]──────[Poll t=60s]──────[Poll t=120s]──>
               │
               └─ sees state A

Provider: ─────────[Event: State B]───────────[Webhook lost]──>
                       │
                       └─ POST to /webhooks ──X (network failure)

Result at t=120s:
  Poll returns State A (stale) because webhook never arrived.

Mitigation:
  - Use idempotency keys.
  - Reconcile with periodic full-sync.
```

## References

- Fielding, R. (2000). *Architectural Styles and the Design of Network-based Software Architectures* (REST dissertation).
- Stripe: Building webhook listeners — https://stripe.com/docs/webhooks/quickstart
