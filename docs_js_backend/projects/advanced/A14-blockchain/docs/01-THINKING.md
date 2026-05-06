# A14 Blockchain Backend: Design Thinking

## Constraints & Forces

### 1. Decentralization vs Performance
A fully decentralized network (Bitcoin) processes 7 TPS. A centralized database processes 100,000 TPS. Every blockchain sits somewhere on this spectrum.

**Resolution**: This project is a centralized backend simulating blockchain concepts. In production, consensus algorithms (PoW, PoS, BFT) replace the single server.

### 2. Security vs Usability
A perfectly secure wallet is an air-gapped hardware device with a 24-word seed. A perfectly usable wallet is a web app that stores keys in localStorage.

**Resolution**: Hot wallets (online) for small amounts, cold wallets (offline) for large amounts. Multi-sig for institutional funds.

### 3. Finality vs Speed
Instant finality requires all validators to agree immediately. This is slow. Fast confirmation (1 block) risks forks and reorgs.

**Resolution**: Wait for N confirmations. Bitcoin: 6 blocks (~1 hour). Ethereum: 12 blocks (~3 minutes after The Merge). This project should wait for confirmation but doesn't.

## Mental Models

### The Blockchain as a Linked List with Consensus
```
Block 0 (Genesis)
  Hash: 0xabc...
  Parent: 0x000...
  Transactions: []
       │
       ▼
Block 1
  Hash: 0xdef...
  Parent: 0xabc...
  Transactions: [tx1, tx2]
       │
       ▼
Block 2
  Hash: 0x123...
  Parent: 0xdef...
  Transactions: [tx3, tx4, tx5]
```

Each block's hash includes the previous block's hash. Changing block 1 invalidates block 2, 3, 4...

### The Nonce as a Sequence Number
Every address has a nonce starting at 0. The first transaction must have nonce 0, the second nonce 1, etc. This prevents replay attacks.

```
Alice's transactions:
  tx1: nonce=0, "Send 5 to Bob"     → Confirmed in block 100
  tx2: nonce=1, "Send 3 to Carol"   → Confirmed in block 101
  
Attacker tries to replay tx1:
  tx_replay: nonce=0, "Send 5 to Bob" → REJECTED (nonce 0 already used)
```

### Gas as Economic Resource Allocation
Transactions compete for limited block space. Gas fees prioritize urgent transactions. Without gas, the network would be flooded with spam.

## Risk Scenarios

1. **Nonce reuse**: Two transactions from the same address use nonce=0. Both may be confirmed, or one may overwrite the other, depending on the network.
2. **No confirmation waiting**: A user sends a transaction, sees "success" immediately, but the transaction is still pending. They send another, double-spending.
3. **Weak address generation**: Using `Math.random()` for addresses creates collisions. Two users could end up with the same address.
4. **No signature validation**: The server doesn't verify that the transaction was signed by the private key of the `from` address.

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| Proof of Work (Bitcoin) | Proven security, truly decentralized | Energy waste, 7 TPS, slow finality |
| Proof of Stake (Ethereum) | 99.95% less energy, faster | Rich-get-richer, slashing complexity |
| BFT / PBFT (Hyperledger) | Instant finality, high TPS | Requires known validators, permissioned |
| DAG (IOTA, Nano) | No fees, high TPS | Different security model, coordinator issues |
| Centralized (Binance) | Fast, cheap | Not really a blockchain; single point of failure |
