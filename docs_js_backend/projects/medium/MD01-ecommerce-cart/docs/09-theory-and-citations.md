# MD01: Database Theory, CAP Theorem, and Bibliography

## Theoretical Foundations

### The CAP Theorem

Proposed by **Eric Brewer** in his keynote at PODC 2000, later formally proven by **Seth Gilbert and Nancy Lynch** (2002):

> "It is impossible for a distributed data store to simultaneously provide more than two out of the following three guarantees: Consistency, Availability, Partition tolerance."

#### Formal Definition (Gilbert & Lynch)
- **Consistency**: Every read receives the most recent write or an error.
- **Availability**: Every request receives a non-error response, without guarantee it contains the most recent write.
- **Partition Tolerance**: The system continues to operate despite arbitrary message loss between nodes.

#### Cart System Positioning

```
        Consistency
             │
             │
    ┌────────┴────────┐
    │                 │
    │    CP during    │
    │    checkout     │
    │                 │
    │    AP during    │
    │    browsing     │
    │                 │
    └────────┬────────┘
             │
    Availability ────── Partition Tolerance
```

During checkout, we choose CP because selling an item we don't have (inconsistency) is worse than rejecting a sale (unavailability). During browsing, we choose AP because showing a slightly stale cart is acceptable.

### ACID Formalization

**Theo Härder and Andreas Reuter (1983)**, "Principles of Transaction-Oriented Database Recovery":

> "A transaction is a transformation of system state that has the properties of Atomicity, Consistency, Isolation, and Durability."

- **Atomicity**: All-or-nothing. Implemented via write-ahead logging (WAL).
- **Consistency**: Integrity constraints preserved. Implemented via constraints and triggers.
- **Isolation**: Concurrent transactions don't interfere. Implemented via locking and MVCC.
- **Durability**: Committed data survives crashes. Implemented via fsync to disk.

### Multi-Version Concurrency Control (MVCC)

PostgreSQL uses MVCC rather than pure locking. This is described in:

**PostgreSQL Documentation**, Chapter 13: Concurrency Control:
> "The main advantage of using the MVCC model of concurrency control rather than locking is that in MVCC locks acquired for querying (reading) data do not conflict with locks acquired for writing data."

In our cart system, this means a user reading their cart does not block another user updating inventory.

### Linearizability vs. Serializability

- **Linearizability** (Herlihy & Wing, 1990): A single-object consistency model. Operations appear to happen atomically.
- **Serializability** (Eswaran et al., 1976): A multi-object consistency model. A schedule of transactions is equivalent to some serial execution.

Our checkout transaction requires **serializability** because it touches multiple tables (carts, cart_items, inventory, orders) atomically.

## Important Papers and References

### Foundational
1. **Brewer, E.** (2000). "Towards Robust Distributed Systems". PODC Keynote.
2. **Gilbert, S. & Lynch, N.** (2002). "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services". ACM SIGACT News.
3. **Härder, T. & Reuter, A.** (1983). "Principles of Transaction-Oriented Database Recovery". ACM Computing Surveys.
4. **Gray, J. & Reuter, A.** (1993). *Transaction Processing: Concepts and Techniques*. Morgan Kaufmann.

### Distributed Systems
5. **DeCandia, G. et al.** (2007). "Dynamo: Amazon's Highly Available Key-value Store". SOSP.
6. **Corbett, J.C. et al.** (2013). "Spanner: Google's Globally-Distributed Database". OSDI.
7. **Kleppmann, M.** (2017). *Designing Data-Intensive Applications*. O'Reilly.
8. **Helland, P.** (2016). "Life Beyond Distributed Transactions". Queue.

### Concurrency
9. **Eswaran, K.P. et al.** (1976). "The Notions of Consistency and Predicate Locks in a Database System". CACM.
10. **Herlihy, M.P. & Wing, J.M.** (1990). "Linearizability: A Correctness Condition for Concurrent Objects". ACM TOPLAS.
11. **Fekete, A. et al.** (2005). "Making Snapshot Isolation Serializable". ACM TODS.

### E-Commerce Specific
12. **Baymard Institute** (2023). "Cart Abandonment Rate Statistics".
13. **Shopify Engineering Blog** (2021). "How We Handle Cart Abandonment at Scale".
14. **Stripe API Documentation** (2024). "Idempotent Requests".

## Glossary

| Term | Definition |
|------|------------|
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **CAP** | Consistency, Availability, Partition tolerance |
| **CRDT** | Conflict-free Replicated Data Type |
| **MVCC** | Multi-Version Concurrency Control |
| **Saga** | Pattern for distributed transactions via compensating actions |
| **WAL** | Write-Ahead Log |
| **2PC** | Two-Phase Commit |
| **FOR UPDATE** | SQL clause acquiring row-level pessimistic lock |
| **Phantom Read** | A transaction re-executes a query and sees new rows |
| **Lost Update** | Two transactions read the same data, and the first write is overwritten |

## Conclusion

The e-commerce cart is a deceptively simple feature that sits at the intersection of database theory, distributed systems, and user experience. By grounding our implementation in formal models — ACID transactions, CAP-aware design, and proven industry patterns — we build a system that is both correct and scalable.

> "Theory is the foundation. Practice is the test." — Adapted from Dijkstra.
