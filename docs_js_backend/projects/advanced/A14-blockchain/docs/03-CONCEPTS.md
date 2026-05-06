# A14 Blockchain Backend: Core Concepts

## WHAT: Blockchain Transaction Backend

A blockchain backend manages wallets, creates and signs transactions, broadcasts them to the network, and tracks their confirmation status.

```
┌─────────────────────────────────────────────────────────────┐
│                  BLOCKCHAIN TRANSACTION LIFECYCLE            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WALLET          TRANSACTION         MEMPOOL         BLOCK  │
│  ──────          ──────────          ───────         ─────  │
│     │                 │                  │             │     │
│     │ Create tx       │                  │             │     │
│     │ Sign with PK    │                  │             │     │
│     │────────────────▶│                  │             │     │
│     │                 │ Broadcast        │             │     │
│     │                 │─────────────────▶│             │     │
│     │                 │                  │ Validate    │     │
│     │                 │                  │ - Signature │     │
│     │                 │                  │ - Nonce     │     │
│     │                 │                  │ - Balance   │     │
│     │                 │                  │             │     │
│     │                 │                  │ Include     │     │
│     │                 │◀─────────────────│─────────────│     │
│     │                 │ Confirmed!       │             │     │
│     │                 │                  │             │     │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why Nonces, Confirmations, and Mining?

### Why Nonces?
Without nonces, an attacker could capture a valid transaction and rebroadcast it indefinitely. Alice sends Bob 1 ETH. Eve captures the signed transaction and rebroadcasts it 100 times. Bob receives 100 ETH. Alice is drained.

The nonce ensures each transaction is unique and order-dependent.

### Why Confirmation Waiting?
A transaction in the mempool is not final. It can be dropped, replaced (EIP-1559), or outcompeted by higher-fee transactions. A user who thinks their payment went through might ship goods before the transaction is actually mined.

### Why Blocks?
Grouping transactions into blocks:
1. Creates a deterministic ordering
2. Enables efficient verification (merkle root)
3. Provides economic finality (proof of work/stake)
4. Allows snapshotting state at block boundaries

## HOW: Correct Implementation

### Nonce Management (Atomic)
```typescript
class NonceManager {
  private nonces = new Map<string, number>();
  private locks = new Map<string, Promise<void>>();

  async getNextNonce(address: string): Promise<number> {
    // Acquire lock for this address
    while (this.locks.has(address)) {
      await this.locks.get(address);
    }

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
}
```

### Transaction Creation with Confirmation
```typescript
async function sendTransaction(wallet: Wallet, txData: TxInput): Promise<Transaction> {
  // 1. Get nonce atomically
  const nonce = await nonceManager.getNextNonce(wallet.address);

  // 2. Create and sign transaction
  const tx = createTransaction({ ...txData, nonce, from: wallet.address });
  tx.signature = sign(tx, wallet.privateKey);

  // 3. Broadcast
  await broadcastTransaction(tx);

  // 4. Wait for confirmation
  const confirmed = await waitForConfirmation(tx.hash, 30000);
  if (!confirmed) {
    throw new Error('Transaction not confirmed within timeout');
  }

  return confirmed;
}
```

## WRONG vs RIGHT

### WRONG: Race Condition in Nonce Generation
```typescript
// BUG: Two concurrent transactions read nonce=0, both use nonce=0
const wallet = getWalletById(walletId);
const tx = createTransaction({
  ...input,
  nonce: wallet.nonce, // Race: both threads see 0
});
wallet.nonce += 1; // Race: both set to 1, but two txs with nonce=0 exist
updateWallet(wallet);
```

**Why it's wrong**: Both transactions have nonce 0. The network will reject one (or both, depending on timing). The user sees "transaction failed" with no clear reason.

### RIGHT: Atomic Nonce Increment
```typescript
// CORRECT: Lock per address, atomic read-increment-write
const nonce = await nonceManager.getNextNonce(wallet.address);
const tx = createTransaction({ ...input, nonce });
// Nonce is guaranteed unique for this address
```

### WRONG: Success Response for Unconfirmed Transaction
```typescript
// BUG: Returns 200 before confirmation
app.post('/transactions', async (req, res) => {
  const tx = createTransaction(req.body);
  broadcastTransaction(tx); // Fire and forget
  res.json({ success: true, transaction: tx }); // tx is still pending!
});
```

**Why it's wrong**: The user believes the payment is complete. They ship goods. The transaction is dropped from the mempool. The merchant is never paid.

### RIGHT: Return Pending Status, Confirm Async
```typescript
// CORRECT: Return pending, confirm asynchronously
app.post('/transactions', async (req, res) => {
  const tx = await createAndBroadcast(req.body);
  res.status(202).json({ status: 'pending', hash: tx.hash });
  
  // Background confirmation
  waitForConfirmation(tx.hash).then(confirmed => {
    if (confirmed) {
      notifyUser(tx.hash, 'confirmed');
    } else {
      notifyUser(tx.hash, 'failed');
    }
  });
});
```
