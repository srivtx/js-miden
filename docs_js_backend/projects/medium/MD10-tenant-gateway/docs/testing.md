# Testing

## Test Structure

```
tests/
  gateway.test.ts   # Tenant and gateway tests
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### Tenant Spoofing
```typescript
it('should reject requests with wrong tenant ID', async () => {
  // Use tenant A's key with tenant B's ID
  // FAILS: Gateway accepts spoofed tenant ID
});
```

### Global Rate Limit
```typescript
it('should rate limit per tenant', async () => {
  // Exhaust tenant A's limit
  // Tenant B should still work
  // FAILS: Tenant B is also blocked
});
```

## Test Utilities

```typescript
async function createTenant(name: string) {
  return request(app).post('/api/tenants').send({ name, subdomain: name });
}
```
