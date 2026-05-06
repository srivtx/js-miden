# A02: Distributed Message Queue

Lightweight message queue with at-least-once delivery.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/queues/:queue/messages | POST | Publish message |
| /api/queues/:queue/messages | GET | Consume message |
| /api/queues/:queue/messages/:id/ack | POST | Acknowledge message |
| /api/topics/:topic/publish | POST | Publish to topic |

## Architecture

- **Storage**: In-memory with optional disk persistence
- **Delivery**: At-least-once with consumer acknowledgments
- **Redelivery**: Exponential backoff on failure
- **Ordering**: FIFO per queue

## Known Issues (for debugging practice)

1. **BUG**: Messages lost on crash (stored in memory only, not persisted)
2. **BUG**: No ordering guarantee (messages processed out of order)

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
