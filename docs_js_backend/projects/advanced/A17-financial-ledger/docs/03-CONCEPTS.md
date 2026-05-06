# Core Concepts

## Double-Entry Bookkeeping

A system where every financial transaction has equal and opposite effects in at least two different accounts.

Example: Pay $500 rent
```
Debit:  Rent Expense      $500
Credit: Cash (Asset)      $500
```

## Chart of Accounts

Standard categories:
- **Assets**: Resources owned (Cash, Inventory, Receivables)
- **Liabilities**: Obligations (Payables, Loans)
- **Equity**: Owner's stake (Capital, Retained Earnings)
- **Revenue**: Income from operations
- **Expenses**: Costs incurred

## Journal Entries

Records of transactions in chronological order. Each entry includes:
- Date
- Accounts debited and credited
- Amounts
- Description/reference

## General Ledger

The complete set of all accounts and their balances. Updated from journal entries.

## Trial Balance

A report listing all accounts with their debit or credit balances. Total debits must equal total credits.

## Exchange Rates & Multi-Currency

- **Spot Rate**: Rate at transaction date
- **Functional Currency**: Primary currency of the business
- **Translation Adjustment**: Gains/losses from converting foreign currency balances

## Hash Chain Audit

Each audit record contains:
- `hash`: SHA-256 of current data + previous hash
- `previousHash`: Hash of the prior record

Tampering detection: recompute hashes and verify chain links.

## Floating-Point vs. Decimal Arithmetic

| Aspect | Float (number) | Decimal (Decimal.js) |
|--------|---------------|---------------------|
| Precision | 53-bit mantissa | Arbitrary precision |
| 0.1 + 0.2 | 0.30000000000000004 | 0.3 |
| Performance | Hardware accelerated | Software library |
| Use Case | Graphics, science | Finance, accounting |
