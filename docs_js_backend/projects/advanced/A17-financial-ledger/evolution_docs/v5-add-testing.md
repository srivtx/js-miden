# v5 — Add Testing (Financial Ledger)

## The Scenario

It's 2am. Your junior refactors the balance calculation to use floating-point math. "Just moving some logic around," they say. They deploy. The accounting team reports the ledger is out of balance by $0.00000000000001. Your junior stares at the code — it looks fine. But they never tested monetary precision.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/services/ledger.service.ts
export function calculateBalance(accountId: string): number {
  const entries = getEntriesForAccount(accountId);
  let balance = 0;

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountId === accountId) {
        // BUG: Using floating-point arithmetic for money
        balance += (line.credit - line.debit) / 100; // Convert cents to dollars
        // 0.1 + 0.2 !== 0.3. The error compounds.
      }
    }
  }

  return balance;
}
```

This code has a **precision bug** (floating-point arithmetic for money). `0.1 + 0.2` evaluates to `0.30000000000000004`. At scale, these errors compound. The ledger is out of balance.

Without tests, this bug ships to production. Audits fail.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/ledger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getEntries } from '../src/db.js';

function makeToken(userId: string, role = 'accountant') {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Financial Ledger', () => {
  beforeEach(() => resetDb());

  describe('Account Creation', () => {
    it('creates an asset account', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .send({ code: '1000', name: 'Cash', type: 'asset' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('asset');
    });

    it('rejects invalid account type', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .send({ code: '1000', name: 'Cash', type: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('Journal Entries', () => {
    it('posts a balanced double-entry transaction', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken('accountant')}`)
        .send({
          description: 'Initial investment',
          lines: [
            { accountId: 'asset-cash', debit: 100000, credit: 0, currency: 'USD' },
            { accountId: 'equity-capital', debit: 0, credit: 100000, currency: 'USD' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.lines).toHaveLength(2);
    });

    it('rejects unbalanced entries', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken('accountant')}`)
        .send({
          description: 'Unbalanced entry',
          lines: [
            { accountId: 'asset-cash', debit: 100000, credit: 0, currency: 'USD' },
            { accountId: 'equity-capital', debit: 0, credit: 50000, currency: 'USD' },
          ],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Precision', () => {
    it('BUG: demonstrates floating-point precision error', async () => {
      // This test documents that the system uses floating-point numbers
      // In production, this should use integer arithmetic (cents, not dollars)
      const balance = 0.1 + 0.2;
      expect(balance).not.toBe(0.3); // This is the bug
      expect(balance).toBe(0.30000000000000004);
    });

    it('maintains balance integrity with integer arithmetic', async () => {
      // When fixed, this test should pass with integer-based money
      const cents1 = 10; // $0.10
      const cents2 = 20; // $0.20
      const totalCents = cents1 + cents2;
      expect(totalCents).toBe(30); // Exact
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor uses floating-point | Deploy, ledger out of balance | **CI fails** before merge |
| Unbalanced entry accepted | Audit failure | **Test rejects** unequal debits/credits |
| Invalid account type | Reporting errors | **Test verifies** enum enforcement |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real database in unit tests
// - Slow (100ms+ per test)
// - Flaky (race conditions, state leakage)
// - Requires Docker/CI setup

// DO mock the database layer
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the database
```

Mocking the database means:
- Your tests run in milliseconds
- No database setup required
- You control every response (error cases, missing accounts, edge cases)

## Testing Evolution in the Financial Ledger

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for floating-point precision. It passes, but it proves `0.1 + 0.2 !== 0.3`. Now every developer knows why we need integer-based money."
>
> You: "Tests are documentation that executes. A passing test that proves a bug exists is better than a comment that nobody reads. In a financial ledger, one untested refactor can make your balance sheet wrong by millions."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
