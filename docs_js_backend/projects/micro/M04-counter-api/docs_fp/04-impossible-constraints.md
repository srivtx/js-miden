# Impossible Constraint: No Atomic Operations

**Task:** Build a global counter across 10 servers without any atomic primitives.

**Constraint:** No Redis INCR. No database transactions. No locks. No compare-and-swap.

---

## Your Turn

How do you count accurately with no atomicity?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (Exactly)

Without atomicity, you have two choices:

**1. Accept inaccuracy:** Use approximate counting (probabilistic data structures)
   - HyperLogLog: Counts unique items with 2% error using 1.5KB memory
   - Count-Min Sketch: Approximate frequency counts

**2. Accept slowness:** Use a single coordinator
   - All increments go to one server
   - That server serializes them
   - Bottleneck at 1 server

**The CAP theorem in action:**
- Consistency (accurate count) + Availability (every server can increment) = No Partition tolerance
- Availability + Partition tolerance = Eventual consistency (inaccurate temporarily)

**This constraint forces you to realize:**

> Atomicity isn't a feature. It's a fundamental requirement for correctness. When you remove it, you must choose between accuracy and availability.
