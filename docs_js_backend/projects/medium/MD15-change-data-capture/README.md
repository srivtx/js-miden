# MD15: Change Data Capture (CDC)

A production-style Change Data Capture system that captures PostgreSQL row changes and publishes them to consumers for cache invalidation and notifications.

## Architecture

- **Express 5** with TypeScript (ESM)
- **PostgreSQL** as the source of truth
- **Simulated WAL Reader** (real CDC would use `pg_logical`)
- **In-Memory Message Queue** with consumer offsets
- **Consumers**: Cache updater, notification sender

## Thinking Framework

### Phase 1: Core Features
1. Capture INSERT/UPDATE/DELETE on `users` and `orders` tables
2. Publish change events to a persistent event log
3. Consumers read events and react (update cache, send notifications)
4. Track consumer offsets for resumability

### Phase 2: Robustness
- **Exactly-Once Delivery**: Duplicate events must be idempotent.
- **Event Ordering**: Consumers must process events in LSN order.
- **WAL Position Recovery**: Restart must resume from the last committed offset, not skip ahead or replay everything.

### Phase 3: Bug Analysis

**Intentional Bug 1: Missed Changes**

Located in `src/services/eventBus.ts` in `pollAndDispatch()`.

The consumer offset can be advanced past valid events (e.g., via bad checkpoint restoration). The system does not validate that the offset is within the valid WAL range:

```typescript
// VULNERABLE CODE:
const offset = await getConsumerOffset(consumerId);
const events = await readChangesSince(offset); // If offset > max_lsn, returns []
```

**Impact**: Events are silently skipped. Cache and downstream systems become inconsistent.

**Fix**: Validate offset against `pg_current_wal_lsn()` or `MAX(lsn)`. If offset is ahead, log a warning and reset to the latest available LSN.

**Intentional Bug 2: Out-of-Order Delivery**

Located in `src/services/eventBus.ts` in `pollAndDispatch()`.

Events are dispatched concurrently using `Promise.all()`, destroying LSN ordering:

```typescript
// VULNERABLE CODE:
await Promise.all(
  events.map(async (event) => {
    await handler(event);
    await setConsumerOffset(consumerId, event.lsn);
  })
);
```

**Impact**: An UPDATE may be applied before its INSERT. Cache shows stale or missing data.

**Fix**: Process events sequentially in LSN order. Update the offset only after the batch is successfully processed.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users` | Create a user (triggers INSERT event) |
| PATCH | `/users/:id` | Update a user (triggers UPDATE event) |
| DELETE | `/users/:id` | Delete a user (triggers DELETE event) |
| POST | `/orders` | Create an order (triggers INSERT event) |
| PATCH | `/orders/:id/status` | Update order status (triggers UPDATE event) |
| GET | `/users` | List all users |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL
docker-compose up -d postgres

# Run tests (some will fail due to intentional bugs)
npm test

# Start development server
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://cdc:cdc123@localhost:5432/cdc
PORT=3000
```

## Testing the Bugs

### Missed Changes
```bash
# After consuming some events, manually tamper the offset:
psql $DATABASE_URL -c "UPDATE cdc_offsets SET last_lsn = 999999 WHERE consumer_id = 'cache';"

# New events will never be consumed because offset is past max LSN.
```

### Out-of-Order Delivery
```bash
# Create a user and immediately update it.
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"test@x.com","name":"Test"}'
curl -X PATCH http://localhost:3000/users/1 -H "Content-Type: application/json" -d '{"name":"Updated"}'

# The cache consumer may show "Test" instead of "Updated" because
# events were processed concurrently.
```
