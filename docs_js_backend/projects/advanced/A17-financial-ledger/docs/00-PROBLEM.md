# Problem Statement

Build a double-entry financial ledger system supporting multi-currency transactions, immutable audit trails, balance verification, and reconciliation.

## Requirements

1. **Double-Entry Bookkeeping**: Every transaction must have balanced debits and credits across multiple accounts.
2. **Accounts**: Hierarchical chart of accounts (assets, liabilities, equity, revenue, expenses).
3. **Journal Entries**: Immutable append-only ledger with hash chaining.
4. **Balance Verification**: Running balances per account with net balance calculation.
5. **Multi-Currency**: Support USD, EUR, GBP, JPY, BTC with exchange rate conversion.
6. **Audit Trail**: Cryptographically linked log of all mutations.
7. **Reconciliation**: Match ledger balances against external statements.

## Constraints

- Monetary values must be precise to the smallest currency unit.
- Ledger must be append-only; no deletions allowed.
- Exchange rates must be timestamped and auditable.

## Known Issue

The system uses native JavaScript floating-point numbers for monetary calculations. This causes precision errors (e.g., `0.1 + 0.2 !== 0.3`), leading to imbalanced transactions and incorrect balances.
