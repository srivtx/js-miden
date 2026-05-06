# 02-architecture.md

## WHAT

The service assigns variants, tracks events, and serves statistics.

## WHY

Separation of assignment, tracking, and analysis keeps each component simple and scalable.

## HOW

```
User → Assignment Service → Variant (consistent)
User → Conversion Event → Event Store
Analyst → Stats API → Aggregated Results
```

- Assignment is stateless (hash-based)
- Conversions are logged
- Stats are computed on demand or via batch jobs
