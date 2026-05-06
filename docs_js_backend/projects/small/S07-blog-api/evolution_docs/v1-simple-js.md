# v1 — The Naive Blog (Pure JS, No Types)

You just want a blog. You spin up Express, write some routes, and call it a day.

```js
// index.js
const express = require('express');
const app = express();
app.use(express.json());

const posts = [];

app.post('/posts', (req, res) => {
  const post = { id: posts.length + 1, ...req.body };
  posts.push(post);
  res.status(201).json(post);
});

app.get('/posts', (_req, res) => {
  res.json(posts);
});

app.listen(3000);
```

It works on your machine. You ship it.

## Then the Pain Hits

**Your teammate sends this:**
```json
POST /posts
{ "title": "Hello", "content": 12345 }
```

`content` is a number now. Your frontend expects a string. Everything breaks.

**Someone else does this:**
```json
POST /posts
{ "tilte": "Oops" }
```

You meant `title`. JavaScript doesn't care. It stores `undefined`. Your database stores `"undefined"`. You don't notice until a user complains.

**And then the data disappears.** You restart the server. The `posts` array is empty. Every blog post is gone because you stored everything in memory.

## The Realization

You need three things, fast:
1. **A database** — memory is ephemeral
2. **Types** — to catch `tilte` before it reaches production
3. **Validation** — because users are creative in the worst ways

This is where the evolution starts.
