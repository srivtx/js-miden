# Architecture

## Overview

The Blockchain Backend provides wallet management, transaction signing and broadcasting, block exploration, and smart contract interaction with proper nonce management to prevent replay attacks.

## Services

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Wallet    │────▶│  PostgreSQL  │
│   (DApp)    │◀────│   Service   │◀────│  (Wallets)   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│ Transaction │────▶│   Signer    │
│   Service   │     │   Service   │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Blockchain │────▶│   Nonce     │
│   Service   │     │   Manager   │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Block      │     │   Contract  │
│  Explorer   │     │   Service   │
└─────────────┘     └─────────────┘
```

## Transaction Flow

1. Client requests nonce for address
2. Client builds and signs transaction
3. Client submits signed transaction
4. Server validates signature and nonce
5. Server broadcasts to mempool
6. Miner includes in block
7. Server waits for confirmation

**Current Issues:**
- Nonce reuse under concurrency
- No confirmation waiting (returns immediately)

## Nonce Management

Each wallet address has a monotonically increasing nonce. Using the same nonce twice causes transaction replacement or replay.

### Correct Implementation
```typescript
// Atomic fetch-and-increment
const nonce = await db.transaction(async (trx) => {
  const wallet = await trx.select('*').from('wallets').where('address', address).forUpdate();
  await trx('wallets').where('address', address).increment('nonce', 1);
  return wallet.nonce;
});
```
