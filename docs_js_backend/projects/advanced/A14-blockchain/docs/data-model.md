# Data Model

## Wallet

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | string | Owner identifier |
| address | string | Ethereum-style address |
| balance | string | Wei balance |
| nonce | integer | Transaction count |
| createdAt | timestamp | Creation time |

## Transaction

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| hash | string | Transaction hash |
| from | string | Sender address |
| to | string | Recipient address |
| value | string | Amount in Wei |
| nonce | integer | Sender nonce at time of tx |
| gasPrice | string | Gas price in Wei |
| gasLimit | string | Gas limit |
| data | string | Call data |
| signature | string | ECDSA signature |
| status | enum | pending, confirmed, failed |
| blockNumber | integer | Mined block |
| createdAt | timestamp | Submission time |

## Block

| Field | Type | Description |
|-------|------|-------------|
| number | integer | Block height |
| hash | string | Block hash |
| parentHash | string | Previous block hash |
| timestamp | Date | Mined time |
| transactions | string[] | Transaction hashes |
| miner | string | Miner address |

## SmartContract

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| address | string | Contract address |
| abi | string | JSON ABI |
| bytecode | string | Deployed bytecode |
| deployedAt | Date | Deployment time |
