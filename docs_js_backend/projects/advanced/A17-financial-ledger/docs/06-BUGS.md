# Bug Analysis

## Bug: Floating-Point Arithmetic for Monetary Values

### Location
- `src/utils/money.ts` - `Money` class uses `number` for all operations
- `src/services/transaction.service.ts` - `create()` validates balance using `!==` on floats
- `src/services/exchange.service.ts` - `convert()` multiplies floats

### Description
JavaScript's `number` type is an IEEE 754 double-precision float. It cannot exactly represent many decimal fractions. When adding, subtracting, or comparing monetary values, tiny precision errors accumulate.

### Impact
- **Transaction Rejection**: `0.1 + 0.2 === 0.3` is `false` in JavaScript, causing valid transactions to be rejected as "unbalanced."
- **Balance Drift**: Repeated operations cause account balances to drift from expected values.
- **Rounding Errors**: Converting between currencies or calculating tax produces incorrect penny amounts.
- **Audit Failure**: Ledger may not reconcile to the cent.

### Reproduction
```typescript
// Test: money.test.ts
const txRes = await request(app)
  .post('/api/transactions')
  .set('x-api-key', 'ledger-secret-key')
  .send({
    reference: 'TX-001',
    entries: [
      { accountId: expenseId, debit: 0.1, credit: 0 },
      { accountId: expenseId, debit: 0.2, credit: 0 },
      { accountId: assetId, debit: 0, credit: 0.3 },
    ],
  });

expect(txRes.status).toBe(500);
expect(txRes.body.error.message).toContain('Debits');
// BUG: 0.1 + 0.2 = 0.30000000000000004 !== 0.3
```

### Fix Strategy

1. **Use Decimal.js** (already in package.json):
```typescript
import { Decimal } from 'decimal.js';

class Money {
  constructor(public amount: Decimal, public currency: string) {}
  
  add(other: Money): Money {
    return new Money(this.amount.plus(other.amount), this.currency);
  }
}
```

2. **Store as Integer Cents**:
```typescript
const cents = Math.round(amount * 100); // Still risky with floats
// Better: receive amounts as strings or integers from client
```

3. **Validate with Tolerance**:
```typescript
const EPSILON = 0.0001;
if (Math.abs(totalDebits - totalCredits) > EPSILON) {
  throw new Error('Unbalanced');
}
```

The correct solution for a financial system is to use Decimal.js or similar arbitrary-precision library for all monetary arithmetic.
