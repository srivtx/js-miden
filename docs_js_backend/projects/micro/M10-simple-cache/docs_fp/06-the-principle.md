# The Principle: What Did Caching Teach You?

## The Fundamental Truth

> **"A cache is a lie you tell about data freshness. The question isn't whether to cache — it's how long the lie can live before it hurts someone."**

## The Junior Question

A junior dev says: "We should cache everything for performance."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Caching trades:
- **Freshness** for **speed**
- **Memory** for **latency**
- **Complexity** for **throughput**

Not everything should be cached:
- **Financial data:** Never stale
- **User permissions:** Stale = security breach
- **Real-time data:** Cache defeats the purpose

**Cache invalidation is one of the two hard problems in computer science.** The other is naming things. The third is off-by-one errors.

## The Realization

Caching isn't a performance optimization. It's a **consistency trade-off.**

Before adding a cache, ask:
1. What happens when the cache is stale?
2. How do I invalidate it?
3. What's the blast radius of stale data?

If you can't answer these, you don't need a cache. You need a faster database.
