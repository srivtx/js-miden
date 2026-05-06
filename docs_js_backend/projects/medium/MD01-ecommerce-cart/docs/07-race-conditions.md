# MD01: Race Conditions and Concurrency Control

## Defining the Battlefield

A race condition occurs when the correctness of a computation depends on the **relative timing** of events. In a cart system, concurrent users (or even the same user with multiple tabs) compete for shared resources: inventory, cart state, and promotional codes.

## Taxonomy of Cart Race Conditions

### Type 1: Inventory Race (The Oversell)

**Scenario**: Two users try to buy the last item.

```
Timeline (No Locking):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ User A Action              │ User B Action
─────┼────────────────────────────┼─────────────────────────────
 T0  │ READ stock = 1             │
 T1  │                            │ READ stock = 1
 T2  │ UPDATE stock = 0           │
 T3  │ COMMIT                     │
 T4  │                            │ UPDATE stock = -1
 T5  │                            │ COMMIT
─────┴────────────────────────────┴─────────────────────────────
Result: Stock = -1. Both believe they purchased. Customer service nightmare.
```

**Solution**: `SELECT ... FOR UPDATE` (pessimistic) or `SERIALIZABLE` isolation (optimistic with retry).

```
Timeline (With FOR UPDATE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ User A Action              │ User B Action
─────┼────────────────────────────┼─────────────────────────────
 T0  │ SELECT ... FOR UPDATE      │
 T1  │ (lock acquired)            │ SELECT ... FOR UPDATE
 T2  │                            │ (waits for lock)
 T3  │ UPDATE stock = 0           │
 T4  │ COMMIT (lock released)     │
 T5  │                            │ SELECT returns stock = 0
 T6  │                            │ UPDATE fails (CHECK constraint)
 T7  │                            │ ROLLBACK
─────┴────────────────────────────┴─────────────────────────────
Result: Stock = 0. User A succeeds, User B gets "Sold Out".
```

### Type 2: The Lost Update (Quantity Change)

**Scenario**: User has cart open in two tabs. In Tab 1, they change quantity from 1→2. In Tab 2, they change from 1→3.

Without concurrency control, the last write wins. Tab 2's update overwrites Tab 1.

**Solution**: Optimistic locking with version numbers.

```sql
-- Tab 1 reads: quantity=1, version=5
-- Tab 2 reads: quantity=1, version=5

-- Tab 1 submits:
UPDATE cart_items
SET quantity = 2, version = 6
WHERE id = 'item-123' AND version = 5;
-- Success: 1 row updated

-- Tab 2 submits:
UPDATE cart_items
SET quantity = 3, version = 6
WHERE id = 'item-123' AND version = 5;
-- Failure: 0 rows updated (version is now 6)
-- Application must re-read and prompt user, or retry.
```

### Type 3: The Phantom Read (Promo Code Abuse)

**Scenario**: A "Buy 1 Get 1 Free" promo is limited to the first 100 customers. Two users check out simultaneously.

```sql
-- Under READ COMMITTED:
BEGIN;
SELECT COUNT(*) FROM orders WHERE promo_code = 'BOGO100';
-- Returns 99
-- ... user proceeds ...
-- Another user commits in between!
INSERT INTO orders (...) VALUES (...);  -- This becomes the 101st order
COMMIT;
```

This is a **phantom read**: a new row appears in the result set between two queries in the same transaction.

**Solution**: `SERIALIZABLE` isolation or an atomic counter update.

```sql
-- Atomic counter (best for this case)
UPDATE promo_codes
SET used_count = used_count + 1
WHERE code = 'BOGO100'
  AND used_count < 100;
-- Check rowCount. If 0, promo exhausted.
```

### Type 4: Deadlock

**Scenario**: Two carts update inventory in opposite order.

```
Transaction A: UPDATE inventory WHERE product_id = 'A' → locks A
Transaction B: UPDATE inventory WHERE product_id = 'B' → locks B
Transaction A: UPDATE inventory WHERE product_id = 'B' → waits for B
Transaction B: UPDATE inventory WHERE product_id = 'A' → waits for A
Result: DEADLOCK. PostgreSQL detects and aborts one transaction.
```

**Solution**: Always acquire locks in a consistent order (e.g., by `product_id` ascending).

```javascript
// Before checkout, sort cart items by product_id
const sortedItems = cartItems.sort((a, b) =>
  a.productId.localeCompare(b.productId)
);

for (const item of sortedItems) {
  await trx.query('SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE', [item.productId]);
}
```

## Isolation Level Decision Matrix

| Scenario | Recommended Isolation | Rationale |
|----------|----------------------|-----------|
| Adding item to cart | `READ COMMITTED` + `FOR UPDATE` on inventory | Speed matters; inventory must be safe |
| Changing quantity | `REPEATABLE READ` or Optimistic Locking | Prevent lost updates |
| Applying promo code | `SERIALIZABLE` or atomic counter | Prevent phantoms |
| Full checkout | `SERIALIZABLE` | All anomalies unacceptable |

## Visualizing Isolation Levels

```
READ UNCOMMITTED:
  [Transaction A] ----[Uncommitted Data Visible]----> [Transaction B]

READ COMMITTED:
  [Transaction A] --COMMIT--> [Data Visible] --> [Transaction B]

REPEATABLE READ:
  [Transaction A] ----[Snapshot]----> [Consistent View Throughout]

SERIALIZABLE:
  [Transaction A] ===[Illusion of Single-Threaded Execution]===> [Transaction B]
```

## The Serializability Theorem

**Maurice Herlihy & Jeannette Wing (1990)**, "Linearizability: A Correctness Condition for Concurrent Objects":

> "A concurrent system is linearizable if every operation appears to take effect instantaneously at some point between its invocation and its response."

`SERIALIZABLE` isolation provides this guarantee at the database level, but at significant performance cost. For high-throughput carts, application-level techniques (ordering, idempotency, atomic counters) are preferred.

## Monitoring Race Conditions

```sql
-- PostgreSQL: Track deadlocks
SELECT deadlocks FROM pg_stat_database WHERE datname = 'ecommerce';

-- Track lock waits
SELECT * FROM pg_locks WHERE NOT granted;
```

Deadlocks should be rare (< 0.01% of transactions). If they spike, investigate lock ordering or transaction length.
