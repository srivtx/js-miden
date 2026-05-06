# Bug Documentation

## Bug: Duplicate Claim Detection Bypassed

### Severity
**High** - Enables fraudulent duplicate payouts.

### Reproduction Steps

1. Submit a claim: `POST /api/claims` with description "Car accident on Main Street"
2. Submit identical claim → correctly rejected as duplicate
3. Submit claim with description "car accident on main street" → **BUG: accepted**
4. Submit claim with description "Car  accident on Main St." → **BUG: accepted**
5. Submit claim with description "Auto collision on Main Street" → **BUG: accepted**

### Root Cause

The duplicate check in `claim.service.ts` uses Prisma's exact equality match:

```typescript
const duplicateCheck = await prisma.claim.findFirst({
  where: {
    policyId: data.policyId,
    incidentDate: data.incidentDate,
    description: data.description, // Exact string match!
    amountRequested: data.amountRequested,
    status: { not: 'DENIED' },
  },
});
```

This is equivalent to SQL:
```sql
SELECT * FROM claims 
WHERE policy_id = ? 
  AND incident_date = ? 
  AND description = ?  -- Exact match
  AND amount_requested = ?
```

Any change in whitespace, case, punctuation, or wording bypasses the check.

### Code Location

File: `src/services/claim.service.ts`
Method: `submitClaim`
Lines: 24-38

### Test Reproduction

File: `tests/claim.test.ts`
Test: `BUG: should allow duplicate with minor description changes`

Run: `npm test -- tests/claim.test.ts`

### Fix Strategy

1. **Normalize descriptions** before storage and comparison
2. **Use similarity algorithms** (Jaccard, Levenshtein, cosine)
3. **Add database constraint** on normalized description hash
4. **Log all similarity scores** for audit

### Prevention

- Never use exact string matching for natural language comparison
- Always normalize user input before storage
- Implement fuzzy matching for all free-text deduplication
- Regularly audit for duplicate claims using similarity search
