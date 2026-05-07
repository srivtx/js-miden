# Red Team: Webhook Attacks

---

## Attack 1: Fake Events

**Payload:** POST to `/webhook` with fake payment event.

**Impact:** Free products, fraudulent orders.

**Defense:** Signature verification.

---

## Attack 2: Replay Attack

**Payload:** Capture legitimate webhook, resend later.

**Impact:** Duplicate fulfillment, double-refund.

**Defense:** Timestamp validation + idempotency.

---

## Attack 3: Webhook DoS

**Payload:** Send 100,000 webhook requests.

**Impact:** Server overwhelmed, legitimate events dropped.

**Defense:** Rate limiting, queue-based processing.
