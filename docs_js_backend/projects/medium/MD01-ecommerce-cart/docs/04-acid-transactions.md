# MD01: ACID Transactions in Cart Operations

## Why ACID Matters for Carts

A cart operation is not a single SQL statement. It is a **workflow**:
1. Validate product exists
2. Check inventory
3. Reserve stock
4. Add item to cart
5. Update cart timestamp
6. Recalculate totals

If step 3 succeeds but step 4 fails, you have reserved stock for a non-existent cart item. This is a **consistency violation**.

ACID (Atomicity, Consistency, Isolation, Durability) was formalized by **Härder & Reuter (1983)**:
> "ACID: The acronym for the four properties that characterize a transaction."

## Isolation Levels and Cart Anomalies

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Lost Update |
|-----------------|------------|---------------------|--------------|-------------|
| READ UNCOMMITTED | Possible | Possible | Possible | Possible |
| READ COMMITTED | No | Possible | Possible | Possible |
| REPEATABLE READ | No | No | Possible | Possible* |
| SERIALIZABLE | No | No | No | No |

*In PostgreSQL, `REPEATABLE READ` prevents lost updates (it errors instead).

### Example: Lost Update under READ COMMITTED

```sql
-- Connection 1 (User A)
BEGIN;
SELECT quantity FROM cart_items WHERE id = 'item-1';  -- returns 1
-- ... user changes quantity to 2 ...
UPDATE cart_items SET quantity = 2 WHERE id = 'item-1';
COMMIT;

-- Connection 2 (User B) - interleaved
BEGIN;
SELECT quantity FROM cart_items WHERE id = 'item-1';  -- returns 1 (at T0)
-- ... user changes quantity to 3 ...
UPDATE cart_items SET quantity = 3 WHERE id = 'item-1';  -- overwrites A's update!
COMMIT;
```

User A's update to `2` is lost. User B never saw the `2`.

### Fix: Use Row-Level Locking

```sql
-- Connection 1
BEGIN;
SELECT quantity FROM cart_items WHERE id = 'item-1' FOR UPDATE;  -- locks row
UPDATE cart_items SET quantity = 2 WHERE id = 'item-1';
COMMIT;

-- Connection 2
BEGIN;
SELECT quantity FROM cart_items WHERE id = 'item-1' FOR UPDATE;  -- WAITS
-- Only proceeds after Connection 1 commits
UPDATE cart_items SET quantity = 3 WHERE id = 'item-1';
COMMIT;
```

## Complete Checkout Transaction

The most complex transaction in an e-commerce system is **checkout**:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. Lock the cart
SELECT * FROM carts WHERE id = 'cart-123' FOR UPDATE;

-- 2. Verify cart is still active
IF (status != 'active') THEN
    ROLLBACK;
    RAISE EXCEPTION 'Cart not active';
END IF;

-- 3. Re-validate all inventory (prices may have changed!)
SELECT ci.product_id, ci.quantity, i.available_quantity
FROM cart_items ci
JOIN inventory i ON ci.product_id = i.product_id
WHERE ci.cart_id = 'cart-123' FOR UPDATE OF i;

-- 4. Check for stock changes since items were added
IF EXISTS (
    SELECT 1 FROM cart_items ci
    JOIN inventory i ON ci.product_id = i.product_id
    WHERE ci.cart_id = 'cart-123'
      AND ci.quantity > i.available_quantity
) THEN
    ROLLBACK;
    RAISE EXCEPTION 'Insufficient stock for one or more items';
END IF;

-- 5. Move reserved → sold
UPDATE inventory
SET reserved_quantity = reserved_quantity - ci.quantity,
    sold_quantity = sold_quantity + ci.quantity
FROM cart_items ci
WHERE ci.cart_id = 'cart-123'
  AND inventory.product_id = ci.product_id;

-- 6. Create order
INSERT INTO orders (id, user_id, cart_id, total_cents, status)
VALUES ('order-456', 'user-789', 'cart-123', 4999, 'pending_payment');

-- 7. Move cart items to order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
SELECT 'order-456', product_id, quantity, unit_price_cents
FROM cart_items WHERE cart_id = 'cart-123';

-- 8. Mark cart converted
UPDATE carts SET status = 'converted' WHERE id = 'cart-123';

COMMIT;
```

If any step fails, the entire transaction rolls back. The inventory is never in an inconsistent state.

## Rollback Scenarios

```sql
-- Scenario: Payment gateway timeout
BEGIN;
  -- ... reserve inventory ...
  -- ... call payment gateway ...
  -- Gateway times out!
ROLLBACK;
-- Inventory is released. No money taken. Cart remains active.
```

```sql
-- Scenario: Partial failure in order creation
BEGIN;
  UPDATE inventory ...;  -- success
  INSERT INTO orders ...; -- success
  INSERT INTO order_items ...; -- FAILS (foreign key violation)
  -- PostgreSQL automatically rolls back the entire transaction
COMMIT;  -- This would error; transaction is already aborted
```

## Savepoints for Partial Undo

For very long cart operations, savepoints allow partial rollback:

```sql
BEGIN;
  INSERT INTO carts ...;  -- step 1
  SAVEPOINT after_cart_creation;

  INSERT INTO cart_items ...;  -- step 2a (succeeds)
  INSERT INTO cart_items ...;  -- step 2b (fails!)
  -- We don't want to lose the whole cart, just item 2b
  ROLLBACK TO SAVEPOINT after_cart_creation;

  -- Cart exists, but only has item 2a
COMMIT;
```

## Performance Considerations

Long transactions hold locks and block other operations:

| Transaction Duration | Impact |
|----------------------|--------|
| < 10ms | Negligible |
| 10-100ms | Acceptable for checkout |
| > 1s | Dangerous; blocks inventory updates |
| > 10s | Catastrophic; likely deadlocks |

Best practice: keep checkout transactions as short as possible. Do not call external services (payment gateways, email APIs) inside the SQL transaction. Use the **Saga pattern** for distributed transactions.

## Reference

- **Jim Gray & Andreas Reuter**, *Transaction Processing: Concepts and Techniques*, 1993. The definitive text on ACID systems.
- **Fekete et al. (2005)**, "Making Snapshot Isolation Serializable", ACM TODS. Explains how to achieve serializability without full locking.
