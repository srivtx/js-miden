# A14 Blockchain Backend: The Problem

## What Problem Are We Solving?

Digital assets need a system of ownership that is:
- **Decentralized**: No single entity controls the ledger
- **Immutable**: Once recorded, transactions cannot be altered
- **Verifiable**: Anyone can audit the entire history
- **Trustless**: Participants don't need to trust each other, only the math

Without blockchain, digital scarcity is impossible. A dollar in a bank account is just a database entry that the bank can change. A Bitcoin is a cryptographically provable, globally auditable asset that no single entity controls.

This project implements a simplified blockchain backend that demonstrates:
- Wallet creation and management
- Transaction signing and broadcasting
- Block mining and confirmation
- Nonce management for replay protection

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Cryptographic identity** | Wallets are derived from private keys. Lose the key = lose the assets. |
| **Nonce uniqueness** | Each transaction from an address must have a unique nonce. Reusing a nonce allows signature replay attacks. |
| **Atomicity** | A transaction either fully executes or fully fails. No partial transfers. |
| **Confirmation finality** | Users need to know when a transaction is irreversible. Double-spend attacks exploit confirmation ambiguity. |
| **Deterministic addressing** | The same private key must always produce the same address. |

## The Specific Domain: Simplified EVM-Compatible Chain

This backend handles:
- **Wallets**: Ethereum-style addresses derived from random seeds
- **Transactions**: Value transfers with gas parameters
- **Blocks**: Groups of transactions with hashes and timestamps
- **Nonce management**: Per-address sequence numbers

## Real-World Context

- **Ethereum**: Processes 1M+ transactions/day. Average gas fee $0.50-$50 depending on congestion.
- **Bitcoin**: 300,000+ transactions/day. 10-minute block time. Energy-intensive PoW.
- **Solana**: 65,000 TPS theoretical. 400ms block time. Uses Proof of History.
- **Binance Smart Chain**: EVM-compatible, 3-second blocks, centralized validator set.

## Why Blockchain Matters (and Why It's Hard)

Blockchain is not a database. It is a **shared state machine** with economic incentives.

Traditional database:
```
Alice sends Bob $10
  → Database UPDATE balances SET amount = amount - 10 WHERE user = 'Alice'
  → Database UPDATE balances SET amount = amount + 10 WHERE user = 'Bob'
  → Admin can reverse this anytime
```

Blockchain:
```
Alice sends Bob 10 ETH
  → Alice signs transaction with private key
  → Transaction broadcast to mempool
  → Validator includes transaction in block
  → Block added to chain
  → Bob's balance updated in global state
  → No one can reverse without 51% of network
```

The trade-off: irreversibility. A bug in a smart contract can drain $600M (The DAO, 2016) with no recourse.

## The Trust Model

```
ALICE                           NETWORK                          BOB
  │                                │                              │
  │ Sign tx: "Send 10 to Bob"     │                              │
  │───────────────────────────────▶│                              │
  │                                │ Validate:                    │
  │                                │ - Signature valid?           │
  │                                │ - Nonce correct?             │
  │                                │ - Balance sufficient?        │
  │                                │                              │
  │                                │ Include in block             │
  │                                │─────────────────────────────▶│
  │                                │ "You received 10 ETH"        │
```

Math replaces trust. The network validates; no single node decides.
