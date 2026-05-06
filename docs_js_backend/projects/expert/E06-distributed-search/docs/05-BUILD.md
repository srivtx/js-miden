# Build & Run

## Prerequisites
- Node.js >= 20
- npm

## Installation
```bash
npm install
```

## Development
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Tests
```bash
npm run test
```

## Docker Compose
```bash
docker-compose up
```
Starts API on port 3006.

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `SHARD_COUNT` | 3 | Number of index shards |
| `REPLICA_COUNT` | 1 | Replication factor stub |
| `DEFAULT_PAGE_SIZE` | 10 | Results per page |
