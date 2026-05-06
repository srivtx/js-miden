# MD01: E-Commerce Cart — Project Overview

## Abstract

This project implements a production-grade shopping cart backend for a medium-scale e-commerce platform. The cart system must handle concurrent user sessions, inventory reservation, promotional pricing, and eventual checkout while maintaining strict consistency guarantees.

## System Context

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Client     │────▶│  API Gateway │────▶│  Cart Service       │
│ (Web/Mobile) │◄────│   (Rate     │◄────│  (Node.js/Express)  │
└──────────────┘     │   Limiting)  │     └─────────────────────┘
                     └──────────────┘              │
                                                   ▼
                     ┌──────────────┐     ┌─────────────────────┐
                     │  Analytics   │◄────│  PostgreSQL (ACID)  │
                     │   Pipeline   │     │  Redis (Session)    │
                     └──────────────┘     └─────────────────────┘
```

## Functional Requirements

1. **Add/Remove Items**: Users can mutate cart contents in real-time.
2. **Inventory Reservation**: Items held in cart must deduct available stock.
3. **Price Consistency**: Cart prices must be frozen or recalculated consistently.
4. **Guest & Authenticated Sessions**: Support both anonymous and logged-in carts.
5. **Cart Abandonment Recovery**: Re-engage users who leave items behind.
6. **Idempotent Operations**: Safe retry semantics for network partitions.

## Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Latency (p99) | < 150ms | User perception of "instant" |
| Consistency | Strong | Over-selling is unacceptable |
| Availability | 99.95% | Revenue-critical path |
| Durability | 100% | No lost carts |

## CAP Theorem Positioning

The cart system chooses **CP** (Consistency over Availability) during inventory reservation, but can degrade to **AP** for read-only cart views. This is consistent with the arguments in Brewer's original CAP conjecture (later formalized by Gilbert & Lynch, 2002): "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services".

> "In a distributed system, you can only support two of the following properties: Consistency, Availability, Partition tolerance." — Eric Brewer, 2000

For an e-commerce cart, partition tolerance is mandatory (network failures happen), so we must choose between C and A. During checkout, we choose C. During browsing, we relax to A.

## Data Model (Simplified)

```sql
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    status VARCHAR(20) CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_cents INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Reference Architecture

This design draws from:
- **Amazon DynamoDB paper** (DeCandia et al., 2007) — for understanding the trade-offs in eventually consistent stores.
- **Spanner** (Corbett et al., 2013) — for TrueTime and external consistency ideas applied to cart expiration.
- **Theo Härder & Andreas Reuter (1983)** — "Principles of Transaction-Oriented Database Recovery", which formalized ACID.

## Files in this Documentation

1. `overview.md` — This file
2. `cart-patterns.md` — Session vs. Database cart patterns
3. `inventory-management.md` — Inventory reservation and stock tracking
4. `acid-transactions.md` — Transaction isolation and SQL examples
5. `idempotency.md` — Idempotency keys and exactly-once semantics
6. `cart-abandonment.md` — Expiration, cleanup, and recovery
7. `race-conditions.md` — Concurrent access scenarios and solutions
8. `real-world-examples.md` — Amazon, Shopify, and Stripe patterns
9. `theory-and-citations.md` — Deeper theory and bibliography
