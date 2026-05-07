# Impossible Constraint: No Memory

**Task:** Calculate exact average and P99 with O(1) memory.

**Constraint:** You can only store 3 numbers.

---

## Your Turn

Can you calculate P99 with only 3 variables?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (Exactly)

With 3 numbers, you can track:
1. Count
2. Sum (for mean)
3. Max

But P99 requires knowing the distribution. You can't derive the 99th percentile from count, sum, and max.

**This constraint forces you to realize:**

> Exact percentiles require memory proportional to data size. Approximate percentiles (histograms, t-digest) trade accuracy for memory.

**For monitoring:** Approximate is fine. You don't need exact P99.

**For billing:** Exact is required. Use a database.
