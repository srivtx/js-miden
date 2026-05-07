# The Principle: What Did Load Balancing Teach You?

## The Fundamental Truth

> **"A load balancer is only as good as its health checks. A perfectly balanced system with dead servers is a perfectly broken system."**

## The Junior Question

A junior dev says: "Round-robin is fair. It distributes evenly."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Fairness is not the goal. **Utilization** is.

- A fast server sitting idle while slow servers struggle is wasteful
- A dead server getting 33% of traffic is broken
- Fairness assumes homogeneity. Real systems are heterogeneous.

## The Realization

Load balancing is about:
1. **Availability:** Don't route to dead servers
2. **Utilization:** Match capacity to load
3. **Latency:** Route to fast servers
4. **Cost:** Don't over-provision

**Not about fairness.**
