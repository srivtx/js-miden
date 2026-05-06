# Testing

## Test Structure

```
tests/
  auction.test.ts   # Bidding and auction tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### Race Condition
```typescript
it('should not allow lower bid to win', async () => {
  // Two concurrent bids
  // FAILS: Last write wins, not highest amount
});
```

### Bid Validation
```typescript
it('should reject bids lower than current highest', async () => {
  // Bid $200, then bid $150
  // FAILS: $150 bid is accepted
});
```

## WebSocket Testing

Use `ws` library for WebSocket tests:
```typescript
const ws = new WebSocket('ws://localhost:3000/ws?auctionId=xxx');
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  expect(msg.type).toBe('bid');
});
```
