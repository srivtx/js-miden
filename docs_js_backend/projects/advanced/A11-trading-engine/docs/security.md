# Security

## Authentication

JWT-based authentication with Bearer tokens.

## Authorization

- Users can only cancel their own orders
- Read access to public order book and trades

## Input Validation

**Current Issues:**
- No price validation (negative prices accepted)
- No quantity limits

**Required Fixes:**
```typescript
if (price <= 0) throw new Error('Price must be positive');
if (quantity <= 0 || quantity > MAX_ORDER_SIZE) throw new Error('Invalid quantity');
```

## Rate Limiting

Prevent order spam:
- Max 100 orders/minute per user
- Max 10 cancellations/minute per user

## Audit Trail

All trades should be immutable and auditable:
- Write-once trade records
- Cryptographic checksums per batch
