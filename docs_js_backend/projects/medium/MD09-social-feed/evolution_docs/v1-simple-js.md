# MD09 Social Feed Engine — v1 Simple JS

> **Motto**: Feed the user before you feed the firehose.

## What We Built

A single-file Express app in JavaScript. Two routes: `POST /posts` creates a post, `GET /feed` returns all posts sorted by creation time with offset pagination. No followers. No fan-out. No database — posts live in a JavaScript Map.

## Why Start Here

- **Speed**: See a feed in 20 lines
- **Clarity**: Understand the data model without fan-out complexity
- **Baseline**: Every later feature (followers, ranking, caching) must justify its ops cost

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express (JS)   │─────▶│  In-Memory      │
│  (Reader)   │◀─────│  /posts /feed   │◀─────│  Map<postId,Post>│
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```javascript
// server.js
const express = require('express');

const app = express();
app.use(express.json());

const posts = new Map();

app.post('/posts', (req, res) => {
  const post = {
    id: Math.random().toString(36).slice(2),
    authorId: req.body.authorId,
    content: req.body.content,
    createdAt: new Date(),
  };
  posts.set(post.id, post);
  res.status(201).json(post);
});

app.get('/feed', (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 20;

  const allPosts = Array.from(posts.values()).sort((a, b) => b.createdAt - a.createdAt);
  const paginated = allPosts.slice(offset, offset + limit);

  res.json({ posts: paginated, offset, limit, total: allPosts.length });
});

app.listen(3000, () => console.log('Social Feed v1 on :3000'));
```

## Problems We Accepted

- No followers — everyone sees every post
- No pagination safety — `offset=999999&limit=10000` could be slow
- Offset pagination causes duplicates when new posts arrive during scroll
- No auth — anyone can post as anyone
- No database — restart the server, lose all posts
- No logging — `console.log` only
- No tests — we hope it works

## Checklist

- [ ] Posts are stored in a JavaScript Map
- [ ] Feed is a simple sort + slice
- [ ] No Redis or database dependency
- [ ] Offset pagination is naive

## Next Step

Add TypeScript so we stop guessing what `req.body.authorId` is.
