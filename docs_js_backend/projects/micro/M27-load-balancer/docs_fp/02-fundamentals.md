# Fundamentals: Load Balancing Algorithms

**Task:** Implement load balancing without libraries.

Algorithms:
- **Round Robin:** Distribute evenly
- **Least Connections:** Route to least busy
- **Weighted:** More capacity = more traffic
- **Random:** Simple, sometimes effective

---

## Multiple Choice: Algorithm Choice

**Q:** You have 3 servers: A (fast), B (slow), C (slow). Which algorithm?

**A)** Round Robin

**B)** Least Connections

**C)** Weighted (A=50%, B=25%, C=25%)

**D)** Random

**Think before reading on.**

---

## The Answer

**C is correct.**

- **Round Robin:** Sends 33% to each. Slow servers drag down average.
- **Least Connections:** B and C might be slow BECAUSE they have connections. Not always correct.
- **Weighted:** Route more to fast server. Optimal for heterogeneous capacity.
- **Random:** Unpredictable. Can overload one server by chance.
