# v5 — Add Testing (Blockchain)

## The Scenario

It's 2am. Your junior refactors the nonce manager to use async/await. "Just moving some logic around," they say. They deploy. Users report duplicate transactions. Your junior stares at the code — it looks fine. But they never tested concurrent nonce allocation.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/services/nonceManager.ts
class NonceManager {
  private nonces = new Map<string, number>();

  async getNextNonce(address: string): Promise<number> {
    const current = this.nonces.get(address) || 0;
    this.nonces.set(address, current + 1);
    return current;
  }
}
```

This code has a **race condition** (non-atomic read-then-write). Two concurrent transactions read the same nonce. Both use nonce `5`. One transaction overwrites the other in the mempool. The network rejects the duplicate.

Without tests, this bug ships to production. Users lose gas fees.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/blockchain.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getTransactions } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Blockchain Backend', () => {
  beforeEach(() => resetDb());

  describe('Wallet Creation', () => {
    it('creates a wallet with zero balance', async () => {
      const res = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${makeToken('user-1')}`);
      expect(res.status).toBe(201);
      expect(res.body.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(res.body.balance).toBe('0');
    });
  });

  describe('Transaction Creation', () => {
    it('rejects invalid address format', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken('user-1')}`)
        .send({ from: 'not-an-address', to: '0xrecipient', value: '100', gasPrice: '1', gasLimit: '21000' });
      expect(res.status).toBe(400);
    });

    it('rejects negative value', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken('user-1')}`)
        .send({ from: '0x1234567890123456789012345678901234567890', to: '0xrecipient', value: '-100', gasPrice: '1', gasLimit: '21000' });
      expect(res.status).toBe(400);
    });
  });

  describe('Nonce Management', () => {
    it('should not reuse nonce for concurrent transactions', async () => {
      const user = 'user-1';
      const walletRes = await request(app).post('/api/wallets').set('Authorization', `Bearer ${makeToken(user)}`);
      const wallet = walletRes.body;

      const [res1, res2] = await Promise.all([
        request(app).post('/api/transactions').set('Authorization', `Bearer ${makeToken(user)}`)
          .send({ from: wallet.address, to: '0xrecipient1', value: '100', gasPrice: '1', gasLimit: '21000' }),
        request(app).post('/api/transactions').set('Authorization', `Bearer ${makeToken(user)}`)
          .send({ from: wallet.address, to: '0xrecipient2', value: '200', gasPrice: '1', gasLimit: '21000' }),
      ]);

      const txs = Array.from(getTransactions().values()).filter(t => t.from === wallet.address);
      const nonces = txs.map(t => t.nonce);
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(nonces.length);
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor breaks nonce locking | Deploy, duplicate nonces | **CI fails** before merge |
| Invalid address accepted | Transactions stuck in mempool | **Test rejects** bad addresses |
| Negative value accepted | Network rejects or exploits | **Test verifies** validation |
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
- You control every response (error cases, missing wallets, edge cases)

## Testing Evolution in the Blockchain

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for concurrent nonce allocation. It passes with unique nonces. If someone removes the lock, it fails. The test is a consensus guard rail."
>
> You: "Tests are documentation that executes. A passing test for nonce uniqueness is a contract with your users' funds. In a blockchain, one untested refactor can lock funds forever."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
