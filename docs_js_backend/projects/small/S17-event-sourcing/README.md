# S17: Event Sourcing Basics

A bank account system using event sourcing patterns.

## Features

- Events: `AccountCreated`, `MoneyDeposited`, `MoneyWithdrawn`
- Store events, rebuild state from events
- Real bugs: Direct state updates, no snapshotting

## Bugs

1. **Direct State Update**: `deposit()` and `withdraw()` mutate state directly instead of replaying events
2. **No Snapshotting**: Replaying 10,000 events on every read is slow

## Quick Start

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```
