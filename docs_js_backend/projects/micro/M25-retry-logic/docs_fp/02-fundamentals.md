# Fundamentals: Exponential Backoff from Scratch

**Task:** Implement retry with exponential backoff.

```javascript
function calculateDelay(attempt, baseDelay = 100, maxDelay = 10000) {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  const jitter = Math.random() * capped;
  return capped + jitter;
}
```

---

## Multiple Choice: Retry Count

**Q:** How many retries should you attempt?

**A)** 3

**B)** 10

**C)** Until success

**D)** It depends on the endpoint

**Think before reading on.**

---

## The Answer

**D is correct.**

- **Read operations:** More retries are safe (idempotent)
- **Write operations:** Fewer retries (risk of duplicate writes)
- **Critical path:** Fail fast, don't retry
- **Background jobs:** Retry many times over hours

**Context matters.**
