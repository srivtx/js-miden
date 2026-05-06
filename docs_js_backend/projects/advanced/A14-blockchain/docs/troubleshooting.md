# Troubleshooting

## Nonce Reuse Errors

**Symptom:** Second transaction rejected with "nonce too low" or replaces first.

**Cause:** `getNonce` and `incrementNonce` are not atomic.

**Fix:**
Use Redis atomic INCR or database row lock:
```typescript
const nonce = await redis.incr(`nonce:${address}`);
```

## Transaction Shows Success But Fails Later

**Symptom:** API returns 200, but transaction reverts on-chain.

**Cause:** API does not wait for block confirmation.

**Fix:**
In `transaction.ts`, wait for confirmation before responding:
```typescript
await broadcastTransaction(tx);
const confirmed = await waitForConfirmation(tx.hash);
if (!confirmed) {
  return res.status(400).json({ error: 'Transaction failed' });
}
res.json({ success: true, transaction: confirmed });
```

## Wallet Not Found

**Checklist:**
- Is the address correct?
- Was the wallet created for the authenticated user?
- Is the database connection healthy?
