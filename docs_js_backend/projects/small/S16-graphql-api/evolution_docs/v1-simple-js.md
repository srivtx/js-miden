# S16 GraphQL API — v1 Simple JS

## The Naive Beginning

You need an API. The simplest thing: REST. But you quickly hit over-fetching.

```js
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const posts = [
  { id: '1', title: 'Hello World', content: 'First post', authorId: '1' },
  { id: '2', title: 'GraphQL 101', content: 'Intro to GraphQL', authorId: '1' },
];

const authors = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
];

// REST: client gets everything, even fields it doesn't need
app.get('/posts', (req, res) => {
  res.json(posts); // includes content, authorId — client only wanted titles
});

app.get('/posts/:id', (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  res.json(post); // includes authorId — client wants author name too, needs second request
});

app.get('/authors/:id', (req, res) => {
  const author = authors.find(a => a.id === req.params.id);
  res.json(author);
});

app.listen(3000);
```

**"REST works. Two requests for one screen is fine. Ship it."**

## The Pain in Production

### 1. Over-Fetching

The mobile app lists posts. It only needs `id` and `title`. But `/posts` returns `content`, `authorId`, and eventually 20 more fields. The payload is 50KB instead of 2KB. Battery and bandwidth are wasted.

### 2. Under-Fetching

The post detail screen needs the post AND the author's name. Two requests: `/posts/1` then `/authors/1`. On 3G, that's 600ms instead of 200ms. The UI has loading states everywhere.

### 3. Endpoint Proliferation

Every new client need requires a new endpoint:
- `/posts?fields=id,title` — custom field selection
- `/posts-with-authors` — joined data
- `/posts-summary` — different shape

Your API surface explodes. Maintenance is a nightmare.

### 4. Versioning Hell

V1 returns `authorId`. V2 returns `author` inline. V3 renames `content` to `body`. You have `/v1/posts`, `/v2/posts`, `/v3/posts`. Clients are on different versions. Documentation is outdated.

## What We Have

- **Over-fetching** — clients get data they don't need
- **Under-fetching** — clients need multiple requests
- **Endpoint explosion** — every client need is a new route
- **Versioning hell** — breaking changes require new URLs

## What v2 Fixes

Basic GraphQL. One endpoint, client-specified fields.
