# MD01: Cart Abandonment and Recovery

## What is Cart Abandonment?

Cart abandonment occurs when a user adds items to their cart but leaves without completing checkout. Industry averages are **70-80%** (Baymard Institute, 2023). This is not a bug; it is a natural part of the shopping funnel.

However, abandoned carts represent:
- **Lost revenue**: $4.6 trillion annually (Business Insider estimate)
- **Locked inventory**: Reserved stock that could be sold to others
- **Data opportunity**: Signals of purchase intent

## The Abandonment Lifecycle

```
User adds item ──► Cart active ──► No activity for T minutes ──► Cart expires
       │                              │
       │                              ▼
       │                       [Optional] Email/SMS reminder
       │                              │
       │                              ▼
       │                       User returns? ──YES──► Reactivate
       │                              │
       │                              NO
       ▼                              ▼
  Checkout complete              Cart abandoned
       │                              │
       ▼                              ▼
  Inventory sold              Inventory released
```

## Expiration Strategies

### Strategy 1: Fixed TTL (Time-To-Live)

Every cart has a hard expiration:

```sql
CREATE TABLE carts (
    id UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    ...
);

-- Cron job runs every 5 minutes
UPDATE carts SET status = 'abandoned'
WHERE status = 'active'
  AND expires_at < NOW();
```

Pros: Predictable, simple.
Cons: A user actively browsing might lose their cart at the 24-hour mark.

### Strategy 2: Sliding Window

Expiration extends with each activity:

```sql
-- On every cart mutation
UPDATE carts
SET expires_at = NOW() + INTERVAL '24 hours',
    updated_at = NOW()
WHERE id = 'cart-123';
```

This is Amazon's approach. Your cart never expires while you're active, but goes stale after a period of inactivity.

### Strategy 3: Item-Level Expiration (Lightning Deals)

For high-demand items, expire individual reservations quickly:

```sql
CREATE TABLE cart_item_reservations (
    cart_item_id UUID PRIMARY KEY,
    reserved_until TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'
);
```

Amazon uses 15-minute windows for Lightning Deals to prevent hoarding.

## Recovery: Re-engagement Pipeline

```sql
-- Find carts eligible for first reminder (abandoned 1 hour ago, no reminder sent)
SELECT c.id, c.user_id, c.updated_at
FROM carts c
LEFT JOIN cart_reminders r ON c.id = r.cart_id AND r.reminder_type = 'email_1h'
WHERE c.status = 'active'
  AND c.updated_at < NOW() - INTERVAL '1 hour'
  AND c.updated_at > NOW() - INTERVAL '2 hours'
  AND r.id IS NULL
  AND c.user_id IS NOT NULL;  -- can't email anonymous users
```

### Recovery Funnel

| Stage | Timing | Action | Typical Recovery Rate |
|-------|--------|--------|----------------------|
| Trigger | Immediate | Pixel tracking event | N/A |
| Reminder 1 | 1 hour | Email: "Forgot something?" | 5-10% |
| Reminder 2 | 24 hours | Email: "Still interested?" | 2-5% |
| Reminder 3 | 72 hours | Email: "Last chance + 10% off" | 1-3% |
| Final | 7 days | SMS (if opted in) | 0.5-2% |

## Inventory Release on Abandonment

```sql
BEGIN;

-- 1. Select carts to expire
WITH expired_carts AS (
    SELECT id FROM carts
    WHERE status = 'active'
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED  -- Don't block other processes
    LIMIT 1000
),
-- 2. Aggregate inventory to release
released_inventory AS (
    SELECT product_id, SUM(quantity) as total_qty
    FROM cart_items
    WHERE cart_id IN (SELECT id FROM expired_carts)
    GROUP BY product_id
)
-- 3. Release stock
UPDATE inventory i
SET reserved_quantity = i.reserved_quantity - r.total_qty
FROM released_inventory r
WHERE i.product_id = r.product_id;

-- 4. Mark carts abandoned
UPDATE carts SET status = 'abandoned'
WHERE id IN (SELECT id FROM expired_carts);

COMMIT;
```

Note `FOR UPDATE SKIP LOCKED`: This allows multiple abandonment workers to run in parallel without deadlocking. If a cart is being checked out simultaneously, the checkout transaction holds the lock; the worker skips it.

## Analytics: Measuring Abandonment

```sql
-- Abandonment rate by category
SELECT
    p.category,
    COUNT(*) FILTER (WHERE c.status = 'abandoned') as abandoned,
    COUNT(*) as total,
    ROUND(
        COUNT(*) FILTER (WHERE c.status = 'abandoned') * 100.0 / COUNT(*),
        2
    ) as abandonment_rate_pct
FROM carts c
JOIN cart_items ci ON c.id = ci.cart_id
JOIN products p ON ci.product_id = p.id
WHERE c.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.category;
```

## Key Insight

> "An abandoned cart is not a failure. It is the beginning of a marketing campaign." — E-commerce Analytics Best Practices

The technical system must support:
1. **Reliable expiration** (inventory release is critical)
2. **Rich event stream** (for remarketing integrations)
3. **User preference respect** (unsubscribe, privacy)

## Citation

- **Baymard Institute (2023)**, "Cart Abandonment Rate Statistics". Comprehensive study of 48 e-commerce sites.
- **Shopify Engineering Blog**, "How We Handle Cart Abandonment at Scale". Describes their Kafka-based reminder pipeline.
