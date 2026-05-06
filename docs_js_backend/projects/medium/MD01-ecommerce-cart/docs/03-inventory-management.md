# MD01: Inventory Management and Stock Reservation

## The Fundamental Problem

Inventory is a **finite, shared resource**. Every item added to a cart is a claim against that resource. The system must answer:

> "If 1,000 users add the last 100 units to their carts simultaneously, who actually gets to buy them?"

This is the classic **"overselling"** problem. Without proper inventory management, you sell stock you don't have, leading to cancellations, refunds, and angry customers.

## Inventory States

A unit of inventory traverses these states:

```
[Available] --add to cart--> [Reserved] --checkout--> [Sold]
     |                              |                      |
     |<------- cart expires --------|                      |
     |<--------------------- return to stock --------------|
```

| State | Description | Queryable |
|-------|-------------|-----------|
| `available` | Unclaimed units | Yes (for customers) |
| `reserved` | In active carts | Internal only |
| `sold` | Checked out | Historical |
| `damaged` | Unsellable | Admin only |

## The Reservation Pattern

Instead of decrementing `available` immediately, maintain a `reserved` column:

```sql
CREATE TABLE inventory (
    product_id UUID PRIMARY KEY,
    total_quantity INT NOT NULL CHECK (total_quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    available_quantity INT GENERATED ALWAYS AS (
        total_quantity - reserved_quantity
    ) STORED
);
```

### Adding to Cart with Reservation

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. Check available stock
SELECT available_quantity FROM inventory WHERE product_id = 'prod-123' FOR UPDATE;

-- 2. If sufficient, reserve
UPDATE inventory
SET reserved_quantity = reserved_quantity + 2
WHERE product_id = 'prod-123'
  AND available_quantity >= 2;

-- 3. Insert cart item
INSERT INTO cart_items (cart_id, product_id, quantity)
VALUES ('cart-456', 'prod-123', 2);

COMMIT;
```

Why `FOR UPDATE`? This acquires a **row-level lock**, preventing concurrent transactions from reading stale `available_quantity`. Without it, two users could both see 1 unit available and both reserve it.

## The Over-Reservation Problem

Reserving stock for carts that never check out (abandonment) leads to **artificial scarcity**. A user adds 100 units to cart and leaves. Those units are now unavailable to others.

### Solutions

1. **Time-Bounded Reservations**: Cart expires after N minutes (Amazon uses ~15 minutes for Lightning Deals, days for normal items).
2. **Soft Reservations**: Don't deduct from `available` until checkout begins.
3. **Queue-Based Reservation**: FIFO queue for high-demand items (concert tickets, sneaker drops).

## Timeline: Race Condition Without Locking

```
User A: READ inventory → sees 1 unit available
User B: READ inventory → sees 1 unit available        [T0]
User A: UPDATE reserved += 1                          [T1]
User B: UPDATE reserved += 1                          [T2]  ← BOTH SUCCEED!
User A: COMMIT                                        [T3]
User B: COMMIT                                        [T4]
Result: 2 units reserved, 1 unit available. OVERSOLD.
```

This is a **Lost Update** anomaly (one of the phenomena defined by ANSI SQL-92 isolation levels). It occurs under `READ COMMITTED` isolation.

## Timeline: Safe Reservation with SELECT FOR UPDATE

```
User A: SELECT ... FOR UPDATE → acquires lock           [T0]
User B: SELECT ... FOR UPDATE → WAITS for lock          [T1]
User A: UPDATE reserved += 1                            [T2]
User A: COMMIT → releases lock                          [T3]
User B: SELECT ... FOR UPDATE → sees 0 available        [T4]
User B: UPDATE fails (CHECK constraint or application)  [T5]
User B: ROLLBACK                                        [T6]
Result: Only 1 unit reserved. Correct.
```

## Alternative: Optimistic Locking (Version Numbers)

For read-heavy inventory, pessimistic locking (`FOR UPDATE`) can bottleneck. Optimistic locking uses a version number:

```sql
CREATE TABLE inventory (
    product_id UUID PRIMARY KEY,
    available_quantity INT NOT NULL,
    version INT NOT NULL DEFAULT 1
);

-- Application logic:
-- 1. Read product and note version
-- 2. In transaction, UPDATE only if version matches

BEGIN;
UPDATE inventory
SET available_quantity = available_quantity - 1,
    version = version + 1
WHERE product_id = 'prod-123'
  AND version = 5          -- the version we read
  AND available_quantity >= 1;

-- Check rowCount. If 0, another transaction won; retry.
COMMIT;
```

This is the pattern used by **Shopify** for flash sales. It trades immediate consistency for throughput, requiring application-level retry loops.

## Releasing Reserved Stock

When a cart expires or is abandoned:

```sql
BEGIN;
-- 1. Find abandoned carts
SELECT cart_id FROM carts
WHERE status = 'active'
  AND updated_at < NOW() - INTERVAL '24 hours';

-- 2. Release inventory
UPDATE inventory i
SET reserved_quantity = reserved_quantity - c.quantity
FROM cart_items c
WHERE c.cart_id IN (...abandoned carts...)
  AND i.product_id = c.product_id;

-- 3. Mark carts abandoned
UPDATE carts SET status = 'abandoned' WHERE id IN (...);
COMMIT;
```

## Key Insight

> "Inventory is not a number. It is a ledger." — Adapted from Martin Kleppmann, *Designing Data-Intensive Applications* (2017).

Every reservation, sale, and return is an append-only event. The `inventory` table is a **materialized view** of the event stream. For high-scale systems, event sourcing (e.g., Kafka + CQRS) becomes necessary.
