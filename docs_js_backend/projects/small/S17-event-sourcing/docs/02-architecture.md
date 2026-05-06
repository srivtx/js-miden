# 02-architecture.md

## WHAT

The system stores events and rebuilds state on demand rather than updating state directly.

## WHY

Direct state updates lose history. Event sourcing preserves every change, enabling debugging, auditing, and time travel.

## HOW

```
Command → Validate → Append Event → Replay Events → Current State
```

- Commands generate events
- Event store appends events
- Aggregates replay events to calculate state
- Snapshots cache state at intervals
