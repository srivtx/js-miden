# The 3AM Page: The Fake Payment

It's 3:00 AM. Your payment provider calls.

**Stripe:** "We're seeing chargebacks on 500 transactions. Your webhook confirmed them."

You check the webhook code:
```javascript
app.post('/webhook', (req, res) => {
  const event = req.body;
  if (event.type === 'payment.success') {
    await fulfillOrder(event.data.orderId);
  }
  res.sendStatus(200);
});
```

**No signature verification.** Anyone can POST to `/webhook` with a fake payment event.

An attacker:
1. Found your webhook URL (from logs, DNS, or guessing)
2. Sent fake `payment.success` events
3. Your system fulfilled 500 orders for free

**$75,000 in fraud. No actual payments received.**

---

## Your Turn

### Q1: Why verify webhook signatures?

The webhook comes from Stripe's IP. Isn't that enough?

<br><br><br><br><br>

---

## The Autopsy

### Answer: IP is not identity

- IPs can be spoofed (in some scenarios)
- DNS can be poisoned
- Your webhook URL might be exposed
- A man-in-the-middle could intercept and modify

**The signature proves:**
1. The payload came from Stripe (only they have the secret)
2. The payload wasn't modified in transit

### The Fix

```javascript
import { createHmac } from 'node:crypto';

function verifyWebhook(payload, signature, secret) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**Also:**
- Replay protection (check timestamp)
- Idempotency (don't process same event twice)
- Async ACK (respond 200 quickly, process in background)
