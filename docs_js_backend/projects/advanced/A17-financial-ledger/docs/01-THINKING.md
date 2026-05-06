# Thinking Process

## Financial Accounting Fundamentals

### Double-Entry System
Every transaction affects at least two accounts. The accounting equation must always balance:
```
Assets = Liabilities + Equity
```

Debits and credits have different effects based on account type:
- **Assets & Expenses**: Debit increases, Credit decreases
- **Liabilities, Equity, Revenue**: Credit increases, Debit decreases

### Immutable Ledger
Once posted, a journal entry cannot be modified. Corrections are made via reversing entries that create new transactions. This ensures auditability and prevents tampering.

### Multi-Currency Complexity
When a transaction involves multiple currencies:
1. Each entry is recorded in its functional currency.
2. Exchange rates are applied at transaction date.
3. Gains/losses from rate fluctuations are recorded separately.

## Hash Chaining for Audit

Inspired by blockchain (but simpler):
```
Log Entry N: hash(data + previousHash)
```
Verifying the chain means recomputing hashes and ensuring each entry links to the previous.

## Precision Problem

JavaScript numbers are IEEE 754 double-precision floats. They cannot represent decimal fractions exactly.
```javascript
0.1 + 0.2 === 0.30000000000000004
```
For financial systems, this is unacceptable. The standard solution is to use integer arithmetic (store values in cents) or a decimal library like Decimal.js.

## Reconciliation

The process of matching internal ledger balances against external sources (bank statements, supplier invoices). Differences may arise from:
- Timing (outstanding checks, deposits in transit)
- Errors (duplicate entries, omissions)
- Fees and interest not yet recorded
