# 01-overview.md

## WHAT

A bank account system built with event sourcing. All state changes are recorded as immutable events.

## WHY

Event sourcing provides a complete audit trail, enables temporal queries, and supports CQRS. The event log is the source of truth.

## HOW

- Events: AccountCreated, MoneyDeposited, MoneyWithdrawn
- Event store appends events immutably
- State is rebuilt by replaying events
- Snapshots optimize performance for large event streams
