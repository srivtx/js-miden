# Thinking Exercises

## 1. The Idempotency

A POST request creates a user. You retry it.

**Question:** How do you prevent duplicate users? What's your idempotency key?

---

## 2. The Timeout

Request timeout is 30s. Backoff delay is 1s, 2s, 4s...

**Question:** What's the total time spent retrying? Is it worth it?

---

## 3. The Ordering

Request A fails. Request B succeeds. You retry A.

**Question:** Does order matter? What if A depends on B?

---

## 4. The State

A retry modifies database state. First attempt partially succeeded.

**Question:** Is the system in a valid state? Can you retry safely?

---

## 5. The Fallback

All retries exhausted. What now?

**Question:** Return error? Return default? Queue for later?
