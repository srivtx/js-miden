# Three Wrong Ways to Retry

---

## Wrong #1: Retry on 4xx

```javascript
if (response.status >= 400) {
  await retry(); // Retry client errors!
}
```

**Why it's wrong:** 400 Bad Request won't succeed on retry. 404 won't appear. You're wasting resources.

**Only retry 5xx (server errors) and network errors.**

---

## Wrong #2: No Idempotency

```javascript
await retry(() => createOrder(userId));
```

**Why it's wrong:** Each retry creates a new order. Duplicate orders!

**Fix:** Use idempotency keys:
```javascript
await retry(() => createOrder(userId, idempotencyKey));
```

---

## Wrong #3: Infinite Retry

```javascript
while (true) {
  try {
    return await fetch(url);
  } catch {
    await sleep(1000);
  }
}
```

**Why it's wrong:** If the service is permanently down, this loops forever. Memory leak. No recovery.

**Fix:** Max retries + circuit breaker.
