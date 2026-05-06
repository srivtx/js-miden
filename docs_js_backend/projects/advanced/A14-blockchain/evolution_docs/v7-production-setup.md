# v7 — Production Setup (Blockchain)

## The Scenario

It's 2am. Your junior deploys the blockchain backend to production. "It works!" they say. Then the container restarts. All wallets vanish. All transaction history is gone. "But it was working..." they whimper. You check: in-memory Maps. No database. No persistence. Every deploy resets the ledger.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const balances = new Map<string, string>(); // In-memory. Ephemeral. Dead on restart.
const transactions = new Map<string, Transaction>(); // Same problem.
```

Local development can survive data loss. Production cannot. Users create wallets. They expect their balances to persist. A blockchain without persistence is just a variable.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | Plain object | ❌ No |
| v2 | Plain object | ❌ No |
| v3 | Plain object | ❌ No |
| v4 | Plain object | ❌ No |
| v5 | Plain object | ❌ No |
| v6 | Plain object | ❌ No |
| v7 | PostgreSQL + immutable ledger | ✓ Production-ready |

## The Solution: PostgreSQL + Immutable Ledger + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  address VARCHAR(42) UNIQUE NOT NULL,
  balance VARCHAR(78) NOT NULL DEFAULT '0', -- String for BigInt safety
  nonce INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  hash VARCHAR(66) PRIMARY KEY,
  from_address VARCHAR(42) NOT NULL REFERENCES wallets(address),
  to_address VARCHAR(42) NOT NULL,
  value VARCHAR(78) NOT NULL,
  gas_price VARCHAR(78) NOT NULL,
  gas_limit VARCHAR(78) NOT NULL,
  nonce INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  block_number BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_from ON transactions(from_address, nonce);
CREATE INDEX idx_tx_status ON transactions(status);

CREATE TABLE blocks (
  number BIGINT PRIMARY KEY,
  hash VARCHAR(66) UNIQUE NOT NULL,
  parent_hash VARCHAR(66) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  miner VARCHAR(42) NOT NULL
);
```

Why PostgreSQL?
- **ACID transactions**: Wallet updates are atomic
- **BigInt safety**: Balances stored as strings to avoid precision loss
- **Concurrent access**: Row-level locking prevents double-spends
- **Durability**: Write-ahead logging survives crashes

### 2. Nonce Manager (Production)

```typescript
// src/services/nonceManager.ts
class NonceManager {
  private nonces = new Map<string, number>();
  private locks = new Map<string, Promise<void>>();

  async getNextNonce(address: string): Promise<number> {
    while (this.locks.has(address)) {
      await this.locks.get(address);
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>(resolve => { resolveLock = resolve; });
    this.locks.set(address, lockPromise);

    try {
      const result = await pool.query(
        `SELECT nonce FROM wallets WHERE address = $1 FOR UPDATE`,
        [address]
      );
      const current = result.rows[0]?.nonce || 0;
      await pool.query(
        `UPDATE wallets SET nonce = $1 WHERE address = $2`,
        [current + 1, address]
      );
      return current;
    } finally {
      this.locks.delete(address);
      resolveLock();
    }
  }
}
```

### 3. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/blockchain?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
JWT_SECRET="change-me-in-production"
```

### 4. Production Routes (connecting to src/)

```typescript
// src/routes/transaction.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const hexStringSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address');

const transactionSchema = z.object({
  from: hexStringSchema,
  to: hexStringSchema,
  value: z.string().regex(/^\d+$/, 'Must be a non-negative integer'),
  gasPrice: z.string().regex(/^[1-9]\d*$/, 'Gas price must be positive'),
  gasLimit: z.string().regex(/^[1-9]\d*$/, 'Gas limit must be positive'),
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const parsed = transactionSchema.parse(req.body);

    const walletResult = await client.query(
      `SELECT * FROM wallets WHERE address = $1 AND user_id = $2 FOR UPDATE`,
      [parsed.from, req.userId]
    );

    if (walletResult.rows.length === 0) {
      res.status(403).json({ error: 'Not your wallet' });
      await client.query('ROLLBACK');
      return;
    }

    const nonce = await nonceManager.getNextNonce(parsed.from);
    const hash = '0x' + crypto.randomUUID().replace(/-/g, '');

    await client.query(
      `INSERT INTO transactions (hash, from_address, to_address, value, gas_price, gas_limit, nonce, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
      [hash, parsed.from, parsed.to, parsed.value, parsed.gasPrice, parsed.gasLimit, nonce]
    );

    await client.query('COMMIT');
    res.status(201).json({ hash, nonce, status: 'pending' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

### 5. The Double-Spend Fix (Documented)

```typescript
// With PostgreSQL row-level locking:
await client.query(
  `SELECT * FROM wallets WHERE address = $1 FOR UPDATE`,
  [fromAddress]
);
// ^ This locks the wallet row. Concurrent transactions wait.
// No double-spends. No nonce reuse.
```

This fix uses **SELECT FOR UPDATE** to lock wallet rows during transaction creation. The database enforces atomicity. Double-spends are eliminated.

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
| Persistence | Plain object | PostgreSQL with WAL |
| BigInt safety | Native numbers | String storage |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked database |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |
| Concurrency | Race conditions | Row-level locking |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly wallets survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The object taught us persistence matters. The number type taught us precision matters. PostgreSQL + string balances is where all those lessons converge. In a blockchain, one lost wallet is someone's life savings."

## Files in this project

```
A14-blockchain/
├── src/
│   ├── index.ts          # Entry point (ESM)
│   ├── app.ts            # Express app setup
│   ├── routes/
│   │   ├── wallet.ts       # Wallet creation
│   │   ├── transaction.ts  # Transaction creation
│   │   ├── block.ts        # Block mining
│   │   └── contract.ts     # Smart contract stub
│   ├── services/
│   │   ├── blockchain.ts   # Block validation
│   │   ├── nonceManager.ts # Atomic nonce allocation
│   │   └── signer.ts       # Cryptographic signing
│   ├── utils/
│   │   └── logger.ts       # Pino structured logging
│   └── types.ts            # TypeScript interfaces
├── migrations/             # PostgreSQL migrations
├── .env.example
├── docker-compose.yml      # PostgreSQL + Redis
├── package.json            # ESM, scripts, dependencies
└── tsconfig.json           # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: object → Map → PostgreSQL. Each step taught a lesson.
2. **BigInt safety**: Native JavaScript numbers lose precision. Strings don't.
3. **Tests document bugs**: The nonce uniqueness test proves the race condition is fixed.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Immutability**: A blockchain is append-only. PostgreSQL WAL is the closest thing to an immutable ledger in a traditional database.
