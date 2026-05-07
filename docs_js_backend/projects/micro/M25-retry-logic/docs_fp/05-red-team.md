# Red Team: Retry Attacks

---

## Attack 1: Retry Storm

**Payload:** Trigger a condition that causes mass retries.

**Impact:** Downstream service overwhelmed. Self-inflicted DDoS.

---

## Attack 2: Idempotency Key Guessing

**Payload:** Guess idempotency keys to replay requests.

**Impact:** Duplicate operations, financial loss.

---

## Attack 3: Slowloris Retry

**Payload:** Request hangs just under timeout. Triggers retry.

**Impact:** Multiple long-running requests. Thread exhaustion.
