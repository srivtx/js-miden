# v7 — Production Setup (Trading Engine)

## The Scenario

It's 2am. Your junior deploys the trading engine to production. "It works!" they say. Then the container restarts. All open orders vanish. All trade history is gone. "But it was working..." they whimper. You check: in-memory Maps. No database. No persistence. Every deploy is a data apocalypse.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const orders = new Map<string, Order>(); // In-memory. Ephemeral. Dead on restart.
const trades = new Map<string, Trade>(); // Same problem.
```

Local development can survive data loss. Production cannot. Traders place orders. They expect them to exist tomorrow. Regulators require trade reporting.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | In-memory arrays | ❌ No |
| v2 | In-memory Maps | ❌ No |
| v3 | In-memory Maps | ❌ No |
| v4 | In-memory Maps | ❌ No |
| v5 | In-memory Maps | ❌ No |
| v6 | In-memory Maps | ❌ No |
| v7 | PostgreSQL + Redis | ✓ Production-ready |

## The Solution: PostgreSQL + Redis + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
  type VARCHAR(6) NOT NULL CHECK (type IN ('limit', 'market')),
  price DECIMAL(19, 4) NOT NULL,
  quantity INTEGER NOT NULL,
  filled_quantity INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_symbol_status ON orders(symbol, status);
CREATE INDEX idx_orders_price_buy ON orders(symbol, price DESC) WHERE side = 'buy';
CREATE INDEX idx_orders_price_sell ON orders(symbol, price ASC) WHERE side = 'sell';

CREATE TABLE trades (
  id UUID PRIMARY KEY,
  buy_order_id UUID NOT NULL REFERENCES orders(id),
  sell_order_id UUID NOT NULL REFERENCES orders(id),
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(19, 4) NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Why PostgreSQL?
- **ACID transactions**: `BEGIN; UPDATE orders ...; INSERT INTO trades ...; COMMIT;`
- **Concurrent access**: Row-level locking prevents over-fills
- **Indexing**: Price-time priority enforced by database indexes
- **Durability**: Write-ahead logging survives crashes

### 2. Redis for Order Book Cache

```typescript
// src/services/orderBookCache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getBookSnapshot(symbol: string): Promise<OrderBook> {
  const cached = await redis.get(`book:${symbol}`);
  if (cached) return JSON.parse(cached);

  const book = await buildBookFromDb(symbol);
  await redis.setex(`book:${symbol}`, 1, JSON.stringify(book)); // 1 second TTL
  return book;
}
```

Why Redis?
- **Sub-millisecond latency**: In-memory cache for hot order book data
- **Pub/sub**: Broadcast market data updates to subscribers
- **Rate limiting**: Prevent order spam per user

### 3. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/trading?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
JWT_SECRET="change-me-in-production"
```

### 4. Production Routes (connecting to src/)

```typescript
// src/routes/orders.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const createSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['limit', 'market']),
  price: z.number().positive().max(1000000)
    .refine((p) => Number.isInteger(p * 100), { message: 'Price must be in whole cents' }),
  quantity: z.number().int().positive().max(10000000),
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const parsed = createSchema.parse(req.body);

    const orderResult = await client.query(
      `INSERT INTO orders (id, user_id, symbol, side, type, price, quantity, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW()) RETURNING *`,
      [crypto.randomUUID(), req.userId, parsed.symbol, parsed.side, parsed.type, parsed.price, parsed.quantity]
    );

    await client.query('COMMIT');
    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

### 5. The Race Condition Fix (Documented)

```typescript
// With PostgreSQL row-level locking:
await client.query(
  `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
  [resting.id]
);
// ^ This locks the row. Concurrent transactions wait. No over-fills.
```

This fix uses **SELECT FOR UPDATE** to lock resting orders during matching. The database enforces atomicity. The race condition is eliminated.

### 6. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "node-pg-migrate up",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | In-memory arrays | PostgreSQL with WAL |
| Cache | None | Redis with TTL |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked database |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |
| Concurrency | Race conditions | Row-level locking |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly orders survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The array taught us persistence matters. The Map taught us concurrency matters. PostgreSQL + Redis is where all those lessons converge. In trading, downtime is measured in millions per minute."

## Files in this project

```
A11-trading-engine/
├── src/
│   ├── index.ts          # Entry point (ESM)
│   ├── app.ts            # Express app setup
│   ├── routes/
│   │   ├── orders.ts     # Order creation + matching
│   │   └── trades.ts     # Trade history
│   ├── services/
│   │   ├── matchingEngine.ts  # Price-time priority matching
│   │   ├── marketData.ts      # Book snapshots
│   │   └── orderBookCache.ts  # Redis cache
│   ├── utils/
│   │   └── logger.ts     # Pino structured logging
│   └── types.ts          # TypeScript interfaces
├── migrations/           # PostgreSQL migrations
├── .env.example
├── docker-compose.yml    # PostgreSQL + Redis
├── package.json          # ESM, scripts, dependencies
└── tsconfig.json         # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: array → Map → PostgreSQL + Redis. Each step taught a lesson.
2. **Validation is non-negotiable**: Zod at the boundary prevents garbage from reaching the book.
3. **Tests document bugs**: The race condition test proves the bug existed and validates the fix.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Row-level locking**: `SELECT FOR UPDATE` is how databases prevent race conditions.
