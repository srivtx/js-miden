# 00-PROBLEM.md

## The Core Problem

How do you build a leaderboard that updates in real-time, preserves the highest score per player, and queries the top 100 in milliseconds—even with millions of entries?

## Real-World Context

Leaderboards are ubiquitous: games, fitness apps, coding challenges, sales dashboards. Users expect instant updates and fast queries. A naive implementation—storing every score in an array and sorting on every read—collapses under load.

## Specific Pain Points

1. **Race conditions**: Two simultaneous score submissions for the same player; the last write wins, even if it's a lower score
2. **Full table scans**: Every leaderboard query sorts the entire dataset, making O(n) complexity
3. **No indexing**: Finding a player's rank requires scanning all entries
4. **Memory bloat**: Storing every historical score instead of only the best per player
5. **Period filtering**: Daily/weekly leaderboards need time-based windowing, which compounds the scan problem

## What This Project Demonstrates

A leaderboard service that accepts score submissions, ranks players, and supports time-based filters—but suffers from race conditions and full table scans.

## ASCII: Naive vs Correct Flow

```
NAIVE (BROKEN)                         CORRECT (INDEXED)
==============                         =================

submitScore(user-1, 100)               submitScore(user-1, 100)
       |                                      |
       v                                      v
  [Array push]                          [ZADD leaderboard 100 user-1]
       |                                      |
       v                                      v
submitScore(user-1, 50)                submitScore(user-1, 50)
       |                                      |
       v                                      v
  [Array push]                          [ZADD leaderboard GT 50 user-1]
       |                                      |  (Redis: GT = only if greater)
       v                                      v
  [Overwrite]                          [No change — 100 preserved]
       |                                      |
       v                                      v
getLeaderboard(top 100)                getLeaderboard(top 100)
       |                                      |
       v                                      v
  [Sort 50,000 items]                  [ZREVRANGE 0 99]
  [O(n log n)]                         [O(log n)]
  [500ms]                              [0.1ms]
```

## Domain

Real-time ranking systems, sorted data structures, race condition prevention, database indexing, Redis Sorted Sets.
