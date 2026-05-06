# Security

## Wallet Security

- Private keys never stored server-side (mock uses client-provided keys)
- Multi-factor authentication for wallet creation
- Rate limiting on transaction submission

## Transaction Security

### Nonce Management
**Current Issue:** Race condition allows nonce reuse.

**Impact:** Transaction replay, unexpected replacement.

**Fix:**
```typescript
// Atomic operation
const nonce = await redis.incr(`nonce:${address}`);
```

### Confirmation Waiting
**Current Issue:** Returns success before transaction is mined.

**Impact:** User thinks transaction succeeded, but it may fail.

**Fix:**
```typescript
const receipt = await waitForConfirmation(hash);
if (!receipt || receipt.status === 0) {
  return res.status(400).json({ error: 'Transaction failed' });
}
```

## Replay Protection

- Chain ID included in transaction signing
- Unique nonce per address
- Signature verification

## Threat Model

### Front-running
Mitigation: Private mempool, commit-reveal schemes.

### Gas Price Manipulation
Mitigation: EIP-1559 fee market, oracle-based gas pricing.
