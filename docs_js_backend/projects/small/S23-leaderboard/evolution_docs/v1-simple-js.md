# S23 Leaderboard — v1 Simple JS

## The Naive Implementation

You need a leaderboard. Simple:

```js
// app.js
const express = require('express');
const app = express();

const scores = [];

app.post('/score', (req, res) => {
  scores.push({ userId: req.body.userId, score: req.body.score });
  res.json({ status: 'ok' });
});

app.get('/leaderboard', (req, res) => {
  const sorted = scores.sort((a, b) => b.score - a.score);
  res.json(sorted.slice(0, 10));
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/score \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","score":100}'
# → { "status": "ok" }

curl http://localhost:3000/leaderboard
# → [{ "userId": "alice", "score": 100 }]
```

## The Pain in Production

### 1. In-Memory Data is Ephemeral

Server restarts. All scores are gone. You deploy a new version. Leaderboard is empty. Your users are furious — they grinded for hours.

### 2. O(n log n) Sort Every Request

Every `GET /leaderboard` sorts the entire array. With 10,000 scores, that's 10,000 log 10,000 comparisons. With 1,000,000 scores, it's a full second of CPU per request. Your server melts under load.

### 3. No Time Windows

There's no "daily", "weekly", "all-time". Every score lives forever. A score from 2022 is ranked against a score from today. Your weekly tournament is meaningless.

### 4. No Rank Queries

A user asks "What's my rank?" You have to sort the entire array and find their position. O(n log n) for a single user query. At scale, this is unusable.

### 5. No Tie Breaking

Two players have the same score. Who is rank 3 and who is rank 4? Your `sort()` is unstable. The order flips between requests. Players complain the leaderboard is wrong.

## The Lesson

An in-memory array is fine for a demo. Production leaderboards need persistence, sorted data structures, time windows, efficient rank queries, and deterministic tie-breaking.

## What v2 Fixes

TypeScript. Before we build a real leaderboard, let's get the types right.
