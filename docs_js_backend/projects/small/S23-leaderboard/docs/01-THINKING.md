# 01-THINKING.md

## Mental Model

Think of a leaderboard like a high-score wall at an arcade. The wall only has space for the top 100 names. When someone gets a new score:
1. Check if it's better than their existing score (race condition prevention)
2. If better, update their position on the wall (indexed update)
3. The wall is always sorted—no need to reorganize it every time someone looks (precomputed index)

## Key Insights

### Insight 1: Leaderboards are read-heavy, write-light

A popular game might have 1M players but only 10K active in a given hour. The leaderboard is queried thousands of times per minute but updated only hundreds of times. Optimize for reads.

### Insight 2: Only the best score matters

Storing every historical score is wasteful. Players only care about their personal best and their rank. Keep one entry per player per period.

### Insight 3: Sorting is expensive; staying sorted is cheap

Sorting 1M items takes ~100ms. Inserting into a sorted structure (B-tree, skip list) takes < 1ms. Use data structures that maintain order.

### Insight 4: Race conditions are invisible until they hurt someone

A player submits a score of 1000, then immediately submits 500 (misclick, lag, retry). The naive code overwrites 1000 with 500. The player drops 50 ranks and rage-quits.

## Design Philosophy

- **Write-time optimization**: Ensure only the best score is stored at submission time
- **Read-time speed**: Queries should be O(log n) or better
- **Atomic updates**: Prevent race conditions with compare-and-swap or database constraints
- **Time windows**: Precompute daily/weekly leaderboards instead of filtering on every read

## Trade-offs Considered

| Storage | Query Top 100 | Update Score | Memory | Best For |
|---------|---------------|--------------|--------|----------|
| Unsorted array | O(n log n) | O(1) | O(n) | Never |
| Sorted array | O(1) | O(n) | O(n) | Tiny datasets |
| B-tree index (Postgres) | O(log n) | O(log n) | Medium | General purpose |
| Redis Sorted Set | O(log n) | O(log n) | Medium | Real-time games |
| Skip list | O(log n) | O(log n) | Medium | In-memory only |

## ASCII: Performance Comparison

```
1,000 scores                    1,000,000 scores
     |                               |
     v                               v
+----------+                   +----------+
| Array    |                   | Array    |
| sort     | 1ms               | sort     | 1000ms
+----------+                   +----------+
     |                               |
     v                               v
+----------+                   +----------+
| Redis    |                   | Redis    |
| ZREVRANGE| 0.05ms            | ZREVRANGE| 0.1ms
+----------+                   +----------+

Redis scales logarithmically. Arrays scale linearly.
```
