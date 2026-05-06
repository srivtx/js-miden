# Core Concepts

## Race Conditions

A race condition occurs when the behavior of software depends on the relative timing of events (like thread execution). In database terms, it's when two transactions interleave in a way that produces incorrect results.

### Types of Race Conditions
- **Read-Modify-Write**: Read value, modify locally, write back
- **Check-Then-Act**: Check condition, then act based on it (our bug)
- **Lost Update**: Two updates overwrite each other

## Database Isolation Levels

| Level | Dirty Read | Non-repeatable Read | Phantom Read |
|-------|-----------|---------------------|--------------|
| Read Uncommitted | Yes | Yes | Yes |
| Read Committed | No | Yes | Yes |
| Repeatable Read | No | No | Yes |
| Serializable | No | No | No |

PostgreSQL default: **Read Committed**

## PostgreSQL Advisory Locks

Application-level locks using `pg_advisory_lock(key)`. Benefits:
- Don't block table scans
- Survive transaction boundaries
- Must be explicitly released

## Temporal Database Patterns

Handling date ranges requires:
- **Overlapping ranges**: Two ranges [a1, a2] and [b1, b2] overlap if `a1 < b2 AND b1 < a2`
- **Exclusion constraints**: PostgreSQL can enforce non-overlapping ranges

## CQRS (Command Query Responsibility Segregation)

Separating read operations (availability queries) from write operations (booking creation). Our bug comes from treating them as independent rather than atomic.

## Optimistic vs Pessimistic Locking

| Approach | Mechanism | Use Case |
|----------|-----------|----------|
| Optimistic | Version numbers, detect conflicts on write | Low contention |
| Pessimistic | Lock rows on read | High contention, limited resources |

Hotel bookings = limited resources = pessimistic locking usually better.
