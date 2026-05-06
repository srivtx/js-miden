# Testing

## Test Structure

```
tests/
  blockchain.test.ts   # Wallet, transaction, nonce tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### Nonce Reuse
```typescript
it('should not reuse nonce for concurrent transactions', async () => {
  // Create wallet
  // Send two transactions concurrently
  // FAILS: Both transactions may use nonce 0
});
```

### No Confirmation Waiting
```typescript
it('should return only after transaction is confirmed', async () => {
  // Submit transaction
  // Response says success but tx is still pending
  // FAILS: status is 'pending', not 'confirmed'
});
```

## Load Testing

Simulate 100 concurrent transactions from same wallet:
```bash
npx autocannon -c 100 -d 10 -m POST \
  -H "Authorization: Bearer <token>" \
  -b '{"from":"0x...","to":"0x...","value":"1"}' \
  http://localhost:3000/api/transactions
```
