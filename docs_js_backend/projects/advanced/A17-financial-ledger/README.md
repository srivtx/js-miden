# A17 Financial Ledger

Double-entry financial ledger system with multi-currency support, immutable append-only storage, balance verification, audit trails, and reconciliation.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│   Express    │────▶│  Account        │
│  (API/CLI)  │     │   Server     │     │  Service        │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                     │                       │
       ▼                     ▼                       ▼
┌─────────────┐     ┌──────────────┐       ┌─────────────────┐
│  Journal    │     │ Transaction  │       │  Ledger Store   │
│  Service    │────▶│  Service     │──────▶│  (PostgreSQL)   │
└─────────────┘     └──────────────┘       └─────────────────┘
       │                     │                       │
       ▼                     ▼                       ▼
┌─────────────┐     ┌──────────────┐       ┌─────────────────┐
│  Exchange   │     │  Audit       │       │  Balance        │
│  Service    │     │  Service     │       │  Verification   │
└─────────────┘     └──────────────┘       └─────────────────┘
```

## Features

- **Double-Entry Bookkeeping**: Every transaction has balanced debits and credits
- **Immutable Ledger**: Append-only journal entries with hash chaining
- **Balance Verification**: Running balance checks per account
- **Multi-Currency**: Exchange rate conversion with Decimal.js
- **Audit Trail**: Tamper-evident logging
- **Reconciliation**: Bank/statement matching stub

## Tech Stack

- Express 5 (ESM)
- TypeScript
- Vitest + Supertest
- Decimal.js (precision arithmetic)
- Winston (logging)

## Known Bugs

1. **Floating-Point Arithmetic**: The `Money` utility uses native JavaScript numbers for calculations, causing precision errors (e.g., `0.1 + 0.2 !== 0.3`).

## Getting Started

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Docker

```bash
docker-compose up -d
```
