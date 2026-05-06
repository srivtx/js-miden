# Troubleshooting

## Race Condition in Matching

**Symptom:** Order book quantities become negative or trades exceed available liquidity.

**Cause:** Multiple concurrent matches read the same resting order state before either writes back.

**Fix:**
1. Use database row-level locks: `SELECT ... FOR UPDATE`
2. Or use atomic CAS operations
3. Or serialize matching through a single worker thread

## Negative Prices Accepted

**Symptom:** Orders with negative prices are created and may match unexpectedly.

**Fix:**
Add validation in `orders.ts`:
```typescript
if (input.price <= 0 && input.type === 'limit') {
  return res.status(400).json({ error: 'Price must be positive' });
}
```

## Order Not Matching

**Checklist:**
- Is the order on the correct side?
- Does the limit price cross the spread?
- Is the order status 'open'?
- Are symbols exactly matching (case-sensitive)?
