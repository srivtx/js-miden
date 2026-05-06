# v1 — The Naive Poll (Pure JS, In-Memory)

You want a quick poll for your team. "Pizza or tacos?" You build it in 10 minutes.

```js
const express = require('express');
const app = express();

const polls = {};
const votes = {}; // pollId -> option -> count

app.post('/polls', (req, res) => {
  const id = Date.now();
  polls[id] = { id, question: req.body.question, options: req.body.options };
  votes[id] = {};
  req.body.options.forEach(o => votes[id][o] = 0);
  res.status(201).json({ id });
});

app.post('/polls/:id/vote', (req, res) => {
  const { option } = req.body;
  votes[req.params.id][option]++;
  res.json({ voted: true });
});

app.get('/polls/:id/results', (req, res) => {
  res.json(votes[req.params.id]);
});

app.listen(3000);
```

It works. You share the link. People vote. You see results.

## Then the Pain Hits

**The server restarts.** Your team was mid-vote. The server crashes because someone sent a weird payload. All votes are gone. The poll is empty.

**Someone votes twice.** You have no deduplication. "Pizza" has 47 votes because one person refreshed the page 47 times.

**The results are stale.** Users have to refresh the page to see new votes. Your "real-time" poll is not real-time.

## The Realization

You need:
1. **Persistence** — memory is not a database
2. **Deduplication** — one person, one vote
3. **Real-time updates** — push results to clients

This is where the evolution starts.
