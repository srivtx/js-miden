# Testing

## Test Structure

```
tests/
  queue.test.ts    # Message queue tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### Message Loss
```typescript
it('should persist messages across restarts', async () => {
  // Publish message
  // Simulate crash (resetDb)
  // FAILS: Message is gone
});
```

### Message Ordering
```typescript
it('should deliver messages in FIFO order', async () => {
  // Publish A, B, C
  // Consume all
  // FAILS: Messages may come out of order
});
```

## Load Testing

```bash
# Publish 1000 messages
for i in {1..1000}; do
  curl -X POST http://localhost:3002/api/queues/load/messages \
    -d "{\"body\":\"msg-$i\"}"
done
```
