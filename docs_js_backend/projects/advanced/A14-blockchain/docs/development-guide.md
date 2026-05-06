# Development Guide

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
src/
  index.ts              # Express app
  config.ts             # Environment config
  types.ts              # Blockchain types
  db.ts                 # In-memory storage
  middleware/
    auth.ts             # JWT middleware
  routes/
    wallet.ts           # Wallet CRUD
    transaction.ts      # Submit & query txs
    block.ts            # Block explorer
    contract.ts         # Contract metadata
  services/
    nonceManager.ts     # BUG: Nonce reuse
    signer.ts           # Mock signing
    blockchain.ts       # Mock blockchain
```

## Adding a New Transaction Type

1. Update transaction validation in `transaction.ts`
2. Add type-specific handling in `blockchain.ts`
3. Update tests

## Testing Nonce Logic

```typescript
// Create wallet
// Submit two transactions concurrently
// Assert nonces are unique
```
