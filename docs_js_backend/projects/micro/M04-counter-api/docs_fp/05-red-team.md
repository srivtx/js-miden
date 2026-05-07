# Red Team: Attacking Counters

---

## Attack 1: Double-Spend

**The vulnerability:** Non-atomic inventory decrement.

```javascript
const stock = await db.getStock(productId);
if (stock > 0) {
  await db.setStock(productId, stock - 1);
  await createOrder(userId, productId);
}
```

**Your attack:**
1. Two requests check stock=1 simultaneously
2. Both see stock > 0
3. Both create orders
4. You sold 2 items with 1 in stock

**Impact:** Overselling, inventory mismatch, angry customers.

**Defense:** Atomic decrement:
```sql
UPDATE products SET stock = stock - 1 WHERE stock > 0;
```

---

## Attack 2: Counter Reset

**The vulnerability:** Counter stored in Redis with no persistence.

**Your attack:**
1. Find a way to trigger Redis flush (memory pressure, admin command)
2. Counter resets to 0
3. Business metrics are wrong
4. Or: trigger enough increments to overflow integer

**Impact:** Lost metrics, incorrect business decisions.

---

## Attack 3: Negative Counter

**The vulnerability:** No lower bound check.

```javascript
await redis.decr('credits'); // Can go negative!
```

**Your attack:**
1. Spend credits faster than they're checked
2. Account goes negative
3. Free service!

**Impact:** Financial loss, abuse.

**Defense:** Check before decrement, or use `HINCRBY` with validation.
