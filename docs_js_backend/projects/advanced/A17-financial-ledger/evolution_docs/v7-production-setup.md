# v7 — Production Setup (Financial Ledger)

## The Scenario

It's 2am. Your junior deploys the ledger to production. "It works!" they say. Then the container restarts. All accounts vanish. All journal entries are gone. "But it was working..." they whimper. You check: in-memory objects. No database. No audit trail. Every deploy resets the books.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const accounts = {}; // In-memory. Ephemeral. Dead on restart.
const entries = []; // Same problem.
```

Local development can survive data loss. Production cannot. Accountants post journal entries. Auditors review histories. A financial ledger without persistence is just a spreadsheet.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | Plain objects | ❌ No |
| v2 | Plain objects | ❌ No |
| v3 | Plain objects | ❌ No |
| v4 | Plain objects | ❌ No |
| v5 | Plain objects | ❌ No |
| v6 | Plain objects | ❌ No |
| v7 | PostgreSQL + immutable audit | ✓ Production-ready |

## The Solution: PostgreSQL + Immutable Audit + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  entry_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES journal_entries(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit BIGINT NOT NULL DEFAULT 0, -- in smallest currency unit (cents)
  credit BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  exchange_rate DECIMAL(19, 8) NOT NULL DEFAULT 1.0,
  CONSTRAINT valid_line CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX idx_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_lines_account ON journal_lines(account_id, entry_id);

CREATE TABLE exchange_rates (
  currency VARCHAR(3) PRIMARY KEY,
  rate DECIMAL(19, 8) NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Why PostgreSQL?
- **ACID transactions**: Journal entries are posted atomically
- **CHECK constraints**: Database enforces double-entry rules
- **BigInt safety**: `BIGINT` stores cents exactly (no floating-point)
- **Durability**: Write-ahead logging survives crashes

### 2. Hash Chaining for Immutability

```typescript
// src/services/audit.service.ts
import { createHash } from 'crypto';

export function calculateEntryHash(entry: JournalEntry): string {
  const data = JSON.stringify({
    date: entry.date,
    description: entry.description,
    lines: entry.lines.map(l => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, currency: l.currency })),
    previousHash: entry.previousHash,
  });
  return createHash('sha256').update(data).digest('hex');
}

export async function verifyLedgerIntegrity(): Promise<boolean> {
  const entries = await pool.query(`SELECT * FROM journal_entries ORDER BY created_at`);
  for (let i = 0; i < entries.rows.length; i++) {
    const entry = entries.rows[i];
    const calculatedHash = calculateEntryHash(entry);
    if (calculatedHash !== entry.hash) return false;
    if (i > 0 && entry.previous_hash !== entries.rows[i - 1].hash) return false;
  }
  return true;
}
```

Why hash chaining?
- **Tamper evidence**: Changing any entry breaks the hash chain
- **Audit integrity**: Auditors can verify the entire ledger history
- **Regulatory compliance**: SOX, GAAP, and IFRS require immutable records

### 3. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/ledger?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
JWT_SECRET="change-me-in-production"
DEFAULT_CURRENCY="USD"
```

### 4. Production Routes (connecting to src/)

```typescript
// src/routes/transaction.routes.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const lineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'BTC']).optional(),
}).refine((l) => l.debit === 0 || l.credit === 0, {
  message: 'A line must have either debit or credit, not both',
});

const entrySchema = z.object({
  description: z.string().min(1).max(500),
  lines: z.array(lineSchema).min(2).max(50),
}).refine((e) => {
  const totalDebit = e.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = e.lines.reduce((s, l) => s + l.credit, 0);
  return totalDebit === totalCredit;
}, { message: 'Debits must equal credits' });

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const parsed = entrySchema.parse(req.body);

    const previousResult = await client.query(
      `SELECT hash FROM journal_entries ORDER BY created_at DESC LIMIT 1`
    );
    const previousHash = previousResult.rows[0]?.hash || 'genesis';

    const entryId = crypto.randomUUID();
    const hash = calculateEntryHash({
      id: entryId,
      date: new Date(),
      description: parsed.description,
      lines: parsed.lines,
      previousHash,
    });

    await client.query(
      `INSERT INTO journal_entries (id, entry_date, description, hash, previous_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [entryId, new Date(), parsed.description, hash, previousHash]
    );

    for (const line of parsed.lines) {
      await client.query(
        `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, currency)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), entryId, line.accountId, line.debit, line.credit, line.currency || 'USD']
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: entryId, hash });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

### 5. The Floating-Point Fix (Documented)

```typescript
// src/utils/money.ts
export function toCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

export function fromCents(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2);
}

// Usage:
const debit = toCents(100.50); // 10050n
const credit = toCents(100.50); // 10050n
const total = debit + credit; // 20100n — exact
```

This fix uses **BigInt** to store monetary values in cents. Floating-point errors are eliminated.

### 6. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "node-pg-migrate up",
    "db:seed": "tsx scripts/seed.ts",
    "audit": "tsx scripts/verify-integrity.ts"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | Plain objects | PostgreSQL with WAL |
| Money storage | Floating-point | BigInt (cents) |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked database |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |
| Audit trail | None | SHA-256 hash chain |
| Immutability | Mutable objects | Append-only ledger |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly journal entries survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The object taught us persistence matters. The floating-point number taught us precision matters. PostgreSQL + BigInt + hash chain is where all those lessons converge. In finance, `0.1 + 0.2 !== 0.3` is not a joke — it's a lawsuit."

## Files in this project

```
A17-financial-ledger/
├── src/
│   ├── index.ts              # Entry point (ESM)
│   ├── app.ts                # Express app setup
│   ├── routes/
│   │   ├── account.routes.ts    # Chart of accounts
│   │   ├── transaction.routes.ts # Journal entry posting
│   │   ├── journal.routes.ts    # Ledger queries
│   │   └── report.routes.ts     # Balance sheet, P&L
│   ├── services/
│   │   ├── ledger.service.ts    # Balance calculation
│   │   ├── transaction.service.ts # Entry creation
│   │   ├── account.service.ts   # Account management
│   │   ├── exchange.service.ts  # Multi-currency conversion
│   │   └── audit.service.ts     # Hash chain verification
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── validate.middleware.ts
│   ├── utils/
│   │   ├── money.ts             # BigInt arithmetic
│   │   ├── validator.ts         # Ledger integrity checks
│   │   └── logger.ts            # Pino structured logging
│   └── types/
│       ├── account.types.ts
│       ├── transaction.types.ts
│       └── journal.types.ts
├── migrations/                 # PostgreSQL migrations
├── .env.example
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json                # ESM, scripts, dependencies
└── tsconfig.json               # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: object → PostgreSQL. Each step taught a lesson.
2. **BigInt for money**: Native JavaScript numbers cause precision errors. BigInt doesn't.
3. **Tests document bugs**: The floating-point test proves why we use cents, not dollars.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Immutable audit trail**: SHA-256 hash chaining makes tampering detectable. In finance, trust is earned through verifiability.
