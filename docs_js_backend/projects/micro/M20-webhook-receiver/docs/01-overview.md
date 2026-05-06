# M20: Webhook Receiver — Overview

## WHAT

The **Webhook Receiver** is an HTTP endpoint that accepts event-driven push notifications from external services (Stripe, GitHub, Slack, etc.). Unlike polling (pull), webhooks deliver data in near real-time when an event occurs.

Typical endpoints:

- `POST /webhooks/stripe` — payment events.
- `POST /webhooks/github` — push, PR, or issue events.
- `POST /webhooks/generic` — custom integrations.

## WHY

Polling is wasteful and high-latency. A polling client making a request every 5 seconds generates **17,280 requests/day** even when no data changes. Webhooks invert the model: the provider pushes data only when events occur.

However, webhooks introduce unique risks:

- **Forged payloads** if signatures are not verified.
- **Replay attacks** if timestamps are not checked.
- **Duplicate processing** if idempotency is not enforced.
- **Denial of Service** if the endpoint does synchronous heavy work.

## HOW

**Safe receiver pattern:**

1. **Acknowledge quickly.** Return `2xx` within seconds.
2. **Verify signature.** Use HMAC-SHA256 with a shared secret.
3. **Check timestamp.** Reject events older than N minutes (e.g., 5 min).
4. **Idempotency key.** Use the provider's event ID to deduplicate.
5. **Queue for processing.** Hand off to a background worker.

```javascript
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  // Queue for async processing
  await jobQueue.add("process-stripe-event", { id: event.id, data: event.data });
  res.status(200).send("OK");
});
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Parse JSON with `express.json()` before signature verification (alters raw body). | Use `express.raw()` to preserve the exact bytes for HMAC verification. |
| No signature verification. | Verify HMAC or asymmetric signature on every request. |
| Synchronous database writes inside the HTTP handler. | Acknowledge immediately; process asynchronously. |
| Ignore event IDs; process duplicates. | Store event IDs and skip already-processed events. |
| No timestamp tolerance. | Enforce a short window (e.g., ±5 minutes) to prevent replays. |

## References

- Stripe: Webhook best practices — https://stripe.com/docs/webhooks/best-practices
- GitHub: Securing webhooks — https://docs.github.com/en/webhooks/using-webhooks/securing-your-webhooks
- OWASP: Webhook Security — https://owasp.org/www-project-web-security-testing-guide/
