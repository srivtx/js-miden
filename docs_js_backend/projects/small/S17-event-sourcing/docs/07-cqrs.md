# 07-cqrs.md

## WHAT

Command Query Responsibility Segregation separates read and write models.

## WHY

The write model is optimized for consistency and validation. The read model is optimized for queries, often denormalized.

## HOW

- Commands → Event Store → Projections → Read Model
- Queries → Read Model

Read models can be rebuilt from the event store at any time, making them disposable.
