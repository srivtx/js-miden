# MD02: Database Theory, CAP Theorem, and Bibliography

## Theoretical Foundations

### Time Range Algebra

Booking systems are instances of **temporal databases**. A foundational paper:

**Snodgrass, R. & Ahn, I.** (1986). "Temporal Databases". IEEE Computer.
> "A temporal database manages time-varying information. Valid time is when a fact is true in the modeled reality. Transaction time is when a fact is stored in the database."

Our `bookings` table captures **valid time** (when the resource is occupied). We do not currently track **transaction time** (bi-temporal), but this could be added for audit:

```sql
-- Bi-temporal extension
CREATE TABLE bookings (
    ...,
    valid_start TIMESTAMPTZ,      -- When the booking is for
    valid_end TIMESTAMPTZ,
    tx_start TIMESTAMPTZ DEFAULT NOW(),  -- When record was inserted
    tx_end TIMESTAMPTZ DEFAULT 'infinity' -- When record was superseded
);
```

### Allen's Interval Algebra

**James F. Allen (1983)**, "Maintaining Knowledge About Temporal Intervals":

Allen defined 13 possible relations between two time intervals:
- `before`, `meets`, `overlaps`, `starts`, `during`, `finishes`, `equals`
- And their inverses

Our overlap condition (`startA < endB AND endA > startB`) captures:
- `overlaps`
- `starts`
- `during`
- `finishes`
- `equals`

All of which represent **conflicts** in a booking system.

```
Relation    Diagram              Condition
─────────────────────────────────────────────────────────────
before      A: |---|  B:      |---|    endA < startB
meets       A: |---|  B:        |---|  endA = startB
overlaps    A: |---|  B:      |---|    startA < startB < endA < endB
during      A:   |-|  B:    |-----|    startB < startA AND endA < endB
starts      A: |---|  B:    |-----|    startA = startB AND endA < endB
finishes    A:   |-|  B:    |-----|    startB < startA AND endA = endB
equals      A: |---|  B:    |---|      startA = startB AND endA = endB
```

### CAP Theorem and Booking Systems

As proven by **Gilbert & Lynch (2002)**:

> "In an asynchronous network, it is impossible to implement a read/write data object that guarantees both consistency and availability in the presence of partition tolerance."

Booking systems choose **CP**:
- During a network partition between two data centers, one must reject writes to prevent double-booking.
- This is acceptable because a "Sorry, this slot is no longer available" message is preferable to two confirmed bookings for the same room.

However, **read availability** can be AP:
- Showing a calendar view from a slightly stale replica is acceptable.
- Only the **write path** (creating a booking) requires CP.

### The Isolation Hierarchy

**Atul Adya (1999)**, "Weak Consistency: A Generalized Theory and Optimistic Implementations for Distributed Transactions":

Adya formalized isolation levels beyond ANSI SQL, introducing phenomena like:
- **G0 (Write Cycles)**: Two transactions write to each other's writes.
- **G1 (Aborted Reads)**: A transaction reads data written by a transaction that later aborts.
- **G2 (Anti-dependency Cycles)**: The phantom read anomaly.

Our exclusion constraint prevents **G2** at the database level.

## Important Papers and References

### Temporal and Calendar Systems
1. **Allen, J.F.** (1983). "Maintaining Knowledge About Temporal Intervals". CACM.
2. **Snodgrass, R.T.** (1995). *The TSQL2 Temporal Query Language*. Kluwer.
3. **Johnston, T. & Weis, R.** (2010). *Managing Time in Relational Databases*. Morgan Kaufmann.

### Concurrency and Isolation
4. **Eswaran, K.P. et al.** (1976). "The Notions of Consistency and Predicate Locks". CACM.
5. **Adya, A.** (1999). PhD Thesis, MIT. "Weak Consistency".
6. **Fekete, A. et al.** (2005). "Making Snapshot Isolation Serializable". TODS.

### Distributed Systems
7. **Brewer, E.** (2000). "Towards Robust Distributed Systems". PODC.
8. **Gilbert, S. & Lynch, N.** (2002). "Brewer's Conjecture...". SIGACT.
9. **Kleppmann, M.** (2017). *Designing Data-Intensive Applications*. O'Reilly.

### Industry References
10. **Google Calendar API Documentation** (2024). developers.google.com/calendar.
11. **Airbnb Engineering Blog** (2022). "How We Prevent Double Bookings".
12. **RFC 5545** (2009). "iCalendar Specification".

## Glossary

| Term | Definition |
|------|------------|
| **Bi-temporal** | Tracking both valid time and transaction time |
| **DST** | Daylight Saving Time |
| **Exclusion Constraint** | PostgreSQL constraint preventing overlapping ranges |
| **GiST** | Generalized Search Tree (index type) |
| **Hold** | Temporary reservation before payment |
| **IANA** | Internet Assigned Numbers Authority (timezone database) |
| **Overlap** | Two time ranges sharing at least one instant |
| **RRULE** | Recurrence rule (RFC 5545) |
| **TIMESTAMPTZ** | Timezone-aware timestamp (UTC internally) |
| **Valid Time** | When a fact is true in the real world |

## Conclusion

Booking systems sit at the intersection of temporal logic, concurrency theory, and user experience. The seemingly simple question — "Is this room free?" — requires:
- A correct overlap algorithm
- Strong isolation guarantees
- Timezone-aware data modeling
- State machines for holds and payments

By grounding our implementation in formal temporal models and proven database techniques, we ensure correctness under concurrent load.

> "Time is what keeps everything from happening at once." — Ray Cummings (and booking systems ensure it stays that way).
