# Common Pitfalls

## WHAT

Webhook receivers are deceptively simple: an HTTP POST handler. In practice, they are a critical security boundary. This document catalogs the most common implementation errors.

## Pitfall 1: No Signature Verification

**WRONG:**
```javascript
app.post("/webhook", express.json(), (req, res) => {
  await processEvent(req.body); // Anyone can POST here
  res.sendStatus(200);
});
```

**RIGHT:**
```javascript
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!verifyHmac(req.body, req.headers["x-signature"], SECRET)) {
    return res.sendStatus(401);
  }
  await processEvent(JSON.parse(req.body));
  res.sendStatus(200);
});
```

## Pitfall 2: Parsing JSON Before Verification

**WRONG:**
```javascript
app.use(express.json());
app.post("/webhook", (req, res) => {
  const body = JSON.stringify(req.body); // NOT original bytes
  verifyHmac(body, ...); // Always fails
});
```

**RIGHT:**
```javascript
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  verifyHmac(req.body, ...); // Buffer of original bytes
});
```

## Pitfall 3: Synchronous Heavy Processing

**WRONG:**
```javascript
app.post("/webhook", async (req, res) => {
  await processPayment(req.body);       // 5s
  await sendEmail(req.body);            // 2s
  await updateCRM(req.body);            // 3s
  res.sendStatus(200); // Provider may have timed out and retried!
});
```

**RIGHT:**
```javascript
app.post("/webhook", async (req, res) => {
  await queue.add("process-webhook", req.body);
  res.sendStatus(200); // Acknowledge in < 1s
});
```

## Pitfall 4: No Timestamp Tolerance

**WRONG:**
```javascript
// Verifies signature but accepts events from any time
```

**RIGHT:**
```javascript
const now = Date.now() / 1000;
if (Math.abs(now - event.timestamp) > 300) {
  return res.sendStatus(400); // Reject stale events
}
```

## Pitfall 5: No Idempotency

**WRONG:**
```javascript
// Every retry creates a new DB row
await db.payment.create({ data: req.body });
```

**RIGHT:**
```javascript
await db.payment.upsert({
  where: { eventId: req.body.id },
  update: {},
  create: { eventId: req.body.id, ...req.body }
});
```

## Pitfall 6: Not Rotating Secrets

**WRONG:**
```javascript
const SECRET = process.env.WEBHOOK_SECRET; // Never changed since 2019
```

**RIGHT:**
```javascript
// Support multiple secrets during rotation
const secrets = process.env.WEBHOOK_SECRETS.split(",");
const valid = secrets.some(s => verifyHmac(req.body, sig, s));
```

## References

- Stripe: Webhook best practices
- GitHub: Securing your webhooks
- OWASP: Testing for Race Conditions
