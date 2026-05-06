# A14 Blockchain Backend: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of cryptography and async programming

## Step 1: Project Setup

```bash
mkdir blockchain-backend && cd blockchain-backend
npm init -y
npm install express jsonwebtoken
npm install -D typescript vitest supertest @types/express @types/node
npx tsc --init
```

## Step 2: Type Definitions

Create `src/types.ts`:
```typescript
export interface Wallet {
  id: string;
  userId: string;
  address: string;
  balance: string;
  nonce: number;
  createdAt: Date;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}

export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactions: string[];
  miner: string;
}
```

## Step 3: Nonce Manager (CORRECT)

Create `src/services/nonceManager.ts`:
```typescript
class NonceManager {
  private nonces = new Map<string, number>();
  private locks = new Map<string, Promise<void>>();

  async getNextNonce(address: string): Promise<number> {
    // Wait for any existing lock
    while (this.locks.has(address)) {
      await this.locks.get(address);
    }

    // Acquire lock
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>(resolve => { resolveLock = resolve; });
    this.locks.set(address, lockPromise);

    try {
      const current = this.nonces.get(address) || 0;
      this.nonces.set(address, current + 1);
      return current;
    } finally {
      this.locks.delete(address);
      resolveLock();
    }
  }

  setNonce(address: string, nonce: number): void {
    this.nonces.set(address, nonce);
  }
}

export const nonceManager = new NonceManager();
```

## Step 4: Blockchain Service (CORRECT)

Create `src/services/blockchain.ts`:
```typescript
import type { Transaction, Block } from '../types.js';
import { createTransaction, getTransactionByHash, createBlock } from '../db.js';

export async function broadcastTransaction(tx: Transaction): Promise<void> {
  await new Promise(r => setTimeout(r, 10));
  createTransaction(tx);
}

export async function waitForConfirmation(hash: string, timeoutMs = 5000): Promise<Transaction | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tx = getTransactionByHash(hash);
    if (tx && tx.status === 'confirmed') {
      return tx;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

export async function mineBlock(transactions: string[]): Promise<Block> {
  const blockNumber = Date.now();
  const block: Block = {
    number: blockNumber,
    hash: '0x' + Math.random().toString(16).slice(2),
    parentHash: '0x' + Math.random().toString(16).slice(2),
    timestamp: new Date(),
    transactions,
    miner: '0xminer',
  };
  createBlock(block);
  // Confirm all transactions in the block
  for (const txHash of transactions) {
    const tx = getTransactionByHash(txHash);
    if (tx) tx.status = 'confirmed';
  }
  return block;
}
```

## Step 5: Transaction Routes (CORRECT)

Create `src/routes/transaction.ts`:
```typescript
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getWalletByAddress, createTransaction, getTransactionByHash } from '../db.js';
import { nonceManager } from '../services/nonceManager.js';
import { broadcastTransaction, waitForConfirmation } from '../services/blockchain.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { from, to, value, gasPrice, gasLimit } = req.body;
  const wallet = getWalletByAddress(from);
  if (!wallet || wallet.userId !== req.userId) {
    res.status(403).json({ error: 'Not your wallet' });
    return;
  }

  // ATOMIC NONCE
  const nonce = await nonceManager.getNextNonce(from);

  const tx = createTransaction({
    hash: '0x' + Math.random().toString(16).slice(2),
    from, to, value, gasPrice, gasLimit, nonce,
    status: 'pending',
    createdAt: new Date(),
  });

  await broadcastTransaction(tx);

  // Wait for confirmation before returning success
  const confirmed = await waitForConfirmation(tx.hash, 5000);
  if (!confirmed) {
    res.status(202).json({ status: 'pending', hash: tx.hash });
    return;
  }

  res.json({ success: true, transaction: confirmed });
});

export { router as transactionRouter };
```

## Step 6: Testing

Create `tests/blockchain.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getTransactions } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Blockchain Backend', () => {
  beforeEach(() => resetDb());

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
```

## Step 7: Run

```bash
npx vitest
```
