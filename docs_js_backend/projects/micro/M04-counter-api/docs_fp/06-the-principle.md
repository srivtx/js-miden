# The Principle: What Did Counting Teach You?

## The Fundamental Truth

> **"The simplest operations become the hardest problems when scale is involved. Counting to 10 is easy. Counting to 10 billion across 100 servers correctly is computer science."**

## The Junior Question

A junior dev says: "Why do we need Redis? Can't we just use a variable?"

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Variables are:
- Single-process only
- Ephemeral (lost on restart)
- Not distributed

**The progression:**
1. Variable (1 process, ephemeral)
2. File (persistent, but slow and complex locking)
3. Database (persistent, transactional, but slower)
4. Redis (in-memory speed, persistence optional, atomic operations)
5. Distributed counters (eventual consistency, approximation)

Each step trades something: speed, consistency, durability, complexity.

## The Realization

Counter accuracy is a **distributed systems problem** disguised as a simple feature.

The question isn't "how do I count?" It's "what consistency model do I need?"

- **Strong consistency:** Database transactions, Redis single-node
- **Eventual consistency:** CRDTs, gossip protocols
- **Approximate:** HyperLogLog, Count-Min Sketch

Choose based on your actual requirements, not what seems "correct."
