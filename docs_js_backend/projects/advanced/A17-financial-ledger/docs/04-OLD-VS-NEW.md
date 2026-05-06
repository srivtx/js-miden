# Old vs. New

## Old Approach: Single-Entry & Floats

```javascript
// Old: Simple subtraction with floats
function withdraw(account, amount) {
  account.balance -= amount; // Dangerous with floats
}
```

Problems:
- No audit trail
- Precision errors accumulate
- No validation that books balance
- Easy to delete or modify past records

## New Approach: Double-Entry with Immutable Ledger

```typescript
// New: Balanced transaction with audit trail
const transaction = await transactionService.create({
  reference: 'TX-001',
  entries: [
    { accountId: expenseId, debit: 100.00, credit: 0 },
    { accountId: cashId, debit: 0, credit: 100.00 },
  ],
});
await transactionService.post(transaction.id);
```

Benefits:
- Mathematical guarantee that debits = credits
- Every change is logged and linked
- Reversals preserve history
- Multi-currency support with proper conversion

## Evolution of Precision Handling

| Aspect | Old | New |
|--------|-----|-----|
| Storage | Float dollars | Integer cents or Decimal |
| Calculation | `a + b` | `Decimal(a).plus(b)` |
| Comparison | `===` | `.equals()` |
| Display | `.toFixed(2)` | `.toDecimalPlaces(2)` |
