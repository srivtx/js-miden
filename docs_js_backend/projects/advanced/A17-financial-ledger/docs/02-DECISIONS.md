# Architectural Decisions

## ADR-001: Double-Entry Validation on Post

**Decision**: Validate that total debits equal total credits before a transaction can be posted.

**Rationale**: Prevents data corruption. The validation happens at the service layer, not the database, for clarity in curriculum.

## ADR-002: Append-Only Ledger with Reversal

**Decision**: Do not allow deletion of transactions. Provide a reversal operation that creates a counter-transaction.

**Rationale**: Maintains immutable audit trail. Reversals are standard accounting practice.

## ADR-003: Hash Chained Audit Logs

**Decision**: Link each audit log entry to the previous via SHA-256 hash.

**Rationale**: Detects tampering. If any entry is modified, the chain verification fails.

## ADR-004: Decimal.js Stub (Intentional Bug)

**Decision**: Use native JavaScript numbers in the Money utility, while including Decimal.js in dependencies.

**Rationale**: Creates a teachable moment about floating-point precision. Students must identify the bug and implement Decimal.js or integer cents.

## ADR-005: Account Hierarchy Stub

**Decision**: Support parentId in accounts but do not implement rollup balances.

**Rationale**: Hierarchical accounts add significant complexity. The schema supports future extension.
