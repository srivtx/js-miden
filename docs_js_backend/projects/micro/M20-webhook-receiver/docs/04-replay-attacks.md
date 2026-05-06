# Replay Attacks

## WHAT

A **replay attack** occurs when an attacker intercepts a valid, signed webhook payload and re-transmits it later. Because the payload is authentic, naive receivers process it again.

## WHY

Even with HMAC verification, timestamps alone do not prevent replays within the verification window. A malicious insider or network adversary can capture a webhook and replay it:

- **Payment webhooks:** Double-charge or double-refund a customer.
- **Inventory webhooks:** Re-process a stock decrement, causing negative inventory.
- **Email webhooks:** Trigger duplicate transactional emails, degrading trust.

## HOW

**Defense in depth:**

1. **Timestamp tolerance:** Reject payloads older than 5 minutes (or your chosen window).
2. **Idempotency key:** Use the provider's event ID. Store processed IDs and skip duplicates.
3. **Nonce tracking:** For ultra-sensitive flows, maintain a short-term nonce cache.

```javascript
const crypto = require("crypto");
const processedEvents = new Set(); // In production: Redis with TTL

function isReplay(eventId, timestamp) {
  const now = Date.now() / 1000;
  const fiveMinutes = 5 * 60;

  // 1. Timestamp check
  if (Math.abs(now - timestamp) > fiveMinutes) {
    return { valid: false, reason: "Timestamp outside tolerance" };
  }

  // 2. Idempotency check
  if (processedEvents.has(eventId)) {
    return { valid: false, reason: "Event already processed" };
  }

  processedEvents.add(eventId);
  return { valid: true };
}
```

## WRONG vs RIGHT

### WRONG: No Timestamp or Idempotency

```javascript
// BAD: Verifies signature but accepts any age and any repetition
app.post("/webhook", (req, res) => {
  if (!verifySignature(req)) return res.sendStatus(401);
  await processPayment(req.body); // Will run again on replay
  res.sendStatus(200);
});
```

### RIGHT: Timestamp + Idempotency

```javascript
// GOOD: Time window + deduplication
app.post("/webhook", async (req, res) => {
  const event = verifyAndParse(req);
  const check = isReplay(event.id, event.timestamp);
  if (!check.valid) {
    console.warn(`Replay blocked: ${check.reason}`);
    return res.sendStatus(409); // Conflict
  }
  await processPayment(event.data);
  res.sendStatus(200);
});
```

## Timeline: Replay Attack

```
Time ──────────────────────────────────────────────────>

Provider: ──[Webhook: Payment $100]──→ Receiver (processes OK)
                │
Attacker:      X (intercepts via packet capture or proxy log)
                │
                └────────────────────────[Replay: Payment $100]──→ Receiver
                                              │
                                              └── Without idempotency:
                                                  Customer charged twice.

Mitigation:
  Receiver stores event ID "evt_123" in Redis (TTL = 24h).
  Replay attempt: "evt_123 already processed" → 409 Conflict.
```

## Breach Story: Bangladesh Bank / SWIFT (2016)

In February 2016, attackers compromised the Bangladesh Bank's SWIFT network and sent $81M in fraudulent transfer requests. The messages were **valid and authenticated**; the attackers simply replayed and modified message sequences after gaining initial foothold. The core failure was insufficient message-sequence validation and lack of idempotency controls at the receiving bank. This is the canonical replay attack in financial infrastructure.

## References

- OWASP: Testing for Session Management — Replay Attack
- SWIFT Customer Security Programme — https://www.swift.com/myswift/customer-security-programme
- RFC 7234 — HTTP Caching (for cache-based replay considerations)
