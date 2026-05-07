# Thinking Exercises

## 1. The Race Condition

You have 100 tickets. 1000 people try to buy simultaneously.

**Question:** How many orders do you create if your check is:
```javascript
if (await getTickets() > 0) { createOrder(); }
```

How about:
```javascript
await db.query('UPDATE tickets SET count = count - 1 WHERE count > 0');
```

---

## 2. The Overflow

You use a 32-bit signed integer. Your counter reaches 2,147,483,647.

**Question:** What happens on the next increment? How do you prevent this?

---

## 3. The Distributed Counter

You have 5 servers. Each increments its own counter. Every minute, you sum them.

**Question:** Can the total ever decrease between minutes? When?

---

## 4. The Approximation

You have 1 billion events/day. Exact counting requires 10 database writes/second.

**Question:** Would you use approximate counting? What error rate is acceptable for analytics vs billing?

---

## 5. The Idempotency

A user clicks "Add to Cart" twice. The button wasn't debounced.

**Question:** How do you count this as 1 click, not 2? What's your idempotency key?
