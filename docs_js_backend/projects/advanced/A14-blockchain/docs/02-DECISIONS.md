# A14 Blockchain Backend: Architecture Decisions

## Decision 1: Simplified EVM Model

**Chosen**: Ethereum-style addresses, nonces, and gas parameters.

**Alternatives Considered**:
- **Bitcoin UTXO model**: Outputs are consumed as inputs. Pro: simpler privacy, no account state. Con: harder to implement smart contracts.
- **Account model (Ethereum)**: Addresses have balances and nonces. Pro: natural for smart contracts. Con: state bloat.
- **DAG (Directed Acyclic Graph)**: No blocks, just transactions referencing each other. Pro: high throughput. Con: different security assumptions.
- **Account abstraction (ERC-4337)**: Smart contracts act as wallets. Pro: social recovery, multi-sig native. Con: very complex.

**Rationale**: The account model is the most intuitive for developers and supports the broadest ecosystem (DeFi, NFTs, DAOs).

## Decision 2: Mock Blockchain

**Chosen**: JavaScript functions simulate mining and confirmation.

**Alternatives Considered**:
- **Ganache/Hardhat local node**: Real EVM execution. Pro: 100% compatible with Ethereum. Con: requires Solidity knowledge.
- **Web3.js/Ethers.js against mainnet**: Connect to real Ethereum. Pro: real data. Con: costs real money, slow.
- **Custom Rust implementation**: Build a minimal blockchain from scratch. Pro: maximum learning. Con: months of work.

**Rationale**: A mock blockchain is sufficient to teach nonce management, confirmation waiting, and transaction lifecycle without blockchain infrastructure complexity.

## Decision 3: In-Memory Storage

**Chosen**: JavaScript Maps for wallets, transactions, and blocks.

**Alternatives Considered**:
- **LevelDB**: Ethereum's database. Pro: proven, fast. Con: binary format, complex.
- **PostgreSQL**: Relational database for blockchain state. Pro: queryable. Con: overkill for a demo.
- **IPFS**: Distributed storage for transaction data. Pro: decentralized. Con: latency, complexity.

**Rationale**: In-memory is fine for a teaching project. Real blockchains need specialized databases (LevelDB, RocksDB, BadgerDB).

## Decision 4: No Nonce Locking

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Atomic increment of nonce. When creating a transaction, lock the wallet, read nonce, increment, create transaction, unlock.

**Why the original skipped it**: To "keep the demo simple." In blockchain, nonce collisions are catastrophic.

## Decision 5: No Confirmation Waiting

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: The transaction endpoint should not return until the transaction is included in a block, or should return a pending status and provide a polling/waiting mechanism.

**Why the original skipped it**: Synchronous waiting complicates the API. But returning "success" for an unconfirmed transaction is fraudulently misleading.
