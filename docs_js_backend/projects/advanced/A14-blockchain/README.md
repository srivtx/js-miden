# A14: Blockchain Backend

Wallet integration, transaction signing, block explorer, and smart contract interaction with nonce management.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/wallets | POST | Create wallet |
| /api/wallets/:id | GET | Get wallet |
| /api/transactions | POST | Send transaction |
| /api/transactions/:hash | GET | Get transaction |
| /api/blocks/latest | GET | Latest blocks |
| /api/contracts | POST | Deploy contract |

## Architecture

- **Wallet Service**: Address generation, balance tracking, nonce management
- **Transaction Service**: Signing, broadcasting, status tracking
- **Block Explorer Service**: Block indexing, transaction lookup
- **Contract Service**: ABI storage, mock interaction

## Known Issues (for debugging practice)

1. **BUG**: Nonce reuse (same nonce used twice = transaction replay)
2. **BUG**: No confirmation waiting (returns success before transaction is confirmed, may fail later)

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
