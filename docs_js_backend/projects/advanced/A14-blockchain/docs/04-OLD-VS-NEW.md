# A14 Blockchain Backend: Old vs New (2015 vs 2025)

## 2015 Approach: Bitcoin-Centric, CLI, Risky

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Bitcoin   │      │  bitcoind    │      │  Wallet.dat  │
│   Core CLI  │◄────►│  (full node) │◄────►│  (unencrypted)│
│             │      │              │      │              │
└─────────────┘      └──────────────┘      └──────────────┘
```

### Characteristics
- **Bitcoin-only**: Ethereum was new; altcoins were scams
- **Full nodes required**: SPV (light clients) were rare
- **Unencrypted wallets**: `wallet.dat` stored private keys in plaintext by default
- **Manual nonce management**: Developers tracked nonces in spreadsheets
- **No smart contracts**: Bitcoin script was limited
- **Mining**: CPU → GPU → FPGA → ASIC arms race

### Code (2015 Style)
```bash
# 2015: Bitcoin RPC
bitcoin-cli sendtoaddress "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" 0.1
# No concept of "confirmation waiting" - just fire and hope
```

### Problems
1. No type safety in RPC responses
2. No event-driven architecture; polling only
3. Wallet backups were manual and error-prone
4. No testnets for development; real money at risk
5. No ERC-20 tokens, no DeFi, no NFTs

---

## 2025 Approach: Multi-Chain, Type-Safe, Secure

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   DApp      │      │  Ethers.js   │      │  MetaMask    │
│  (Next.js)  │◄────►│  / Viem      │◄────►│  (Browser)   │
└─────────────┘      └──────┬───────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  RPC Node    │
                     │  (Alchemy/   │
                     │   Infura)    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Blockchain  │
                     │  (Ethereum/  │
                     │   L2 Rollup) │
                     └──────────────┘
```

### Characteristics
- **Multi-chain**: Ethereum, Polygon, Arbitrum, Base, Solana
- **Type-safe clients**: Viem (TypeScript) provides full type safety for contract interactions
- **Hardware wallets**: Ledger, Trezor for cold storage
- **Smart accounts (ERC-4337)**: Social recovery, session keys, gasless transactions
- **L2 rollups**: 10x cheaper, 10x faster than Ethereum mainnet
- **Indexing**: The Graph, Goldsky for querying on-chain data

### Code (2025 Style)
```typescript
// 2025: Viem + TypeScript + Smart Account
import { createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const client = createWalletClient({ account, chain: mainnet, transport: http() });

const hash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
  nonce: await client.getTransactionCount({ address: account.address }), // Atomic
});

// Wait for receipt
const receipt = await client.waitForTransactionReceipt({ hash });
console.log(receipt.status); // 'success' or 'reverted'
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Dominant chain | Bitcoin | Ethereum + L2s |
| Wallet storage | wallet.dat (local) | Browser extension + hardware |
| Development | Bitcoin RPC | Viem, Ethers.js, Hardhat, Foundry |
| Smart contracts | Limited (Bitcoin Script) | Turing-complete (Solidity, Rust, Move) |
| Nonce management | Manual | Automatic (library handles it) |
| Confirmation | Polling blocks | WebSocket subscriptions, event-driven |
| Testing | Testnet with real value | Local anvil node, fork testing |
| Security | Hope | Formal verification, audits, bug bounties |

## What Changed Dramatically

- **DeFi (2020)**: $100B+ in smart contracts handling loans, swaps, and derivatives
- **NFTs (2021)**: Digital ownership of art, music, and virtual real estate
- **L2 Scaling (2022-2024)**: Rollups (Arbitrum, Optimism, Base) make Ethereum usable
- **Account Abstraction (2023)**: ERC-4337 enables smart contract wallets with social recovery
- **Institutional Adoption (2024)**: Bitcoin ETFs, Ethereum ETFs, corporate treasuries holding crypto

## What Didn't Change

- **Private key = ownership**: Lose the key, lose the funds. Forever.
- **Code is law**: Smart contract bugs are irreversible
- **51% attacks**: PoW and PoS both require majority honesty
- **Regulatory uncertainty**: Every jurisdiction has different rules
