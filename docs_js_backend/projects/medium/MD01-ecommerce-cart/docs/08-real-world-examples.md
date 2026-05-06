# MD01: Real-World Examples and Case Studies

## Amazon: The Gold Standard

Amazon's cart system is one of the most studied in e-commerce engineering.

### Key Features
1. **Persistent Cross-Device Cart**: Log in anywhere, your cart is there. This requires server-side storage with eventual consistency across regions.
2. **Saved for Later**: Items can be moved to a "Saved" list without losing them. This is essentially a secondary cart with different expiration rules.
3. **Dynamic Pricing**: Prices update in real-time. If an item's price drops while in cart, the cart reflects the new price.
4. **Subscribe & Save**: Recurring purchase integration within the cart flow.

### Amazon's Architecture (Inferred from Patents and Papers)
- **DynamoDB** (originally Dynamo) for cart state: "Dynamo: Amazon's Highly Available Key-value Store" (DeCandia et al., SOSP 2007).
- **Event-driven inventory**: Cart changes publish to an event bus (likely Kafka or internal equivalent).
- **Regional replication**: Carts are replicated across availability zones, possibly with conflict-free replicated data types (CRDTs) for merge resolution.

> "The shopping cart service must always be able to write to and read from its data store, and its data needs to be available across multiple data centers." — Amazon Dynamo Paper

## Shopify: Scale for Merchants

Shopify powers millions of merchant stores. Their cart must be multi-tenant and configurable.

### Key Patterns
1. **Webhooks**: Cart changes fire webhooks to merchant apps. This is an async, decoupled pattern.
2. **Script Editor**: Merchants can write Ruby scripts to modify cart behavior (discounts, restrictions). This requires a sandboxed execution environment.
3. **Flash Sale Handling**: Shopify uses a combination of:
   - **Optimistic locking** for inventory
   - **Checkout queues** ("You are in line") for extreme traffic (e.g., Kylie Cosmetics drops)

### Shopify's Checkout Queue

```
User clicks checkout
        │
        ▼
[Load Balancer] ──► [Queue Service]
                           │
                           ▼
                    [Token Bucket]
                           │
                           ▼
              [Allowed to checkout?]
                    /          \
                 YES            NO
                  │              │
                  ▼              ▼
            [Proceed]      [Wait in Queue]
            [Checkout]     [Polling endpoint]
```

## Stripe: The Checkout API

While not a cart system per se, Stripe's Checkout product demonstrates best practices for the **payment-critical** phase.

### Idempotency in Practice
Stripe's idempotency keys are the industry standard. They guarantee exactly-once processing for:
- Payment Intent creation
- Subscription creation
- Refunds

Stripe stores idempotency records in **etcd** (a strongly consistent key-value store), not in the primary transaction database, to avoid coupling.

## Walmart: Inventory Precision

Walmart operates on razor-thin margins. Inventory accuracy is existential.

### The "Inventory Ledger" Pattern
Instead of a single `quantity` column, Walmart uses an append-only ledger:

```sql
CREATE TABLE inventory_events (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(20) NOT NULL,
    event_type VARCHAR(20) CHECK (event_type IN ('receive', 'sale', 'return', 'adjustment')),
    quantity_delta INT NOT NULL,
    event_time TIMESTAMPTZ DEFAULT NOW(),
    source_system VARCHAR(50)
);

-- Current quantity is the SUM of all deltas
SELECT product_id, SUM(quantity_delta) as current_quantity
FROM inventory_events
WHERE product_id = 'SKU-123'
GROUP BY product_id;
```

This is **event sourcing** applied to inventory. It provides complete auditability and simplifies reconciliation.

## eBay: Bidding and Cart Integration

eBay's "Buy It Now" adds an item directly to cart, but auction wins create a different flow:
1. User wins auction
2. Item is auto-added to a special "Auction Won" cart
3. Cart has a fixed 4-day expiration (much shorter than normal carts)

This shows how **business rules drive cart expiration policy**.

## Comparison Table

| Company | Storage | Inventory Model | Idempotency | Abandonment |
|---------|---------|-----------------|-------------|-------------|
| Amazon | DynamoDB | Reserved stock | Session tokens | 24h+ sliding |
| Shopify | PostgreSQL | Optimistic locks | Webhook dedup | Merchant config |
| Stripe | etcd + Postgres | N/A (payment only) | UUID keys | N/A |
| Walmart | Kafka + DB | Event sourcing | Request hashing | Analytics-driven |
| eBay | Oracle (legacy) | Immediate deduct | Token-based | Rule-based (4 days) |

## Lessons Applied to This Project

1. **Start with PostgreSQL**: For medium scale, PostgreSQL with proper indexing and isolation is sufficient. Don't prematurely optimize to DynamoDB.
2. **Implement idempotency early**: It is much harder to add retroactively.
3. **Separate inventory reservation from cart mutation**: These are different consistency boundaries.
4. **Monitor abandonment as a business metric**: Engineering should build the pipeline; Product/Marketing owns the recovery emails.
