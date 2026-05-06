# API Reference

## Authentication

Bearer token required for wallet and transaction endpoints.

## Wallet

### POST /api/wallets
Create a new wallet.

**Response:**
```json
{
  "id": "uuid",
  "address": "0xabc...",
  "balance": "1000000000000000000",
  "nonce": 0,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /api/wallets/:id
Get wallet by ID.

## Transaction

### POST /api/transactions
Submit a signed transaction.

**Body:**
```json
{
  "from": "0xabc...",
  "to": "0xdef...",
  "value": "1000000000000000000",
  "gasPrice": "20000000000",
  "gasLimit": "21000",
  "data": "0x",
  "privateKey": "mock-private-key"
}
```

**BUGS:**
- Returns success before confirmation
- Nonce may be reused under concurrent requests

### GET /api/transactions/:hash
Get transaction by hash.

## Block Explorer

### GET /api/blocks/latest
Get latest 10 blocks.

### GET /api/blocks/:number
Get block by number.

## Contracts

### POST /api/contracts
Deploy contract metadata.

### GET /api/contracts
List deployed contracts.
