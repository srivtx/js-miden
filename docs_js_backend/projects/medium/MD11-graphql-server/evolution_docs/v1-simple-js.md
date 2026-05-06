# MD11 GraphQL Server — v1 Simple JS

## Overview
We start with a plain Express REST API in JavaScript. No types, no schema, no GraphQL. Just `GET /users`, `GET /posts`, and `GET /users/:id/posts`. The goal is to feel the pain of over-fetching and N+1 round-trips before we introduce GraphQL.

## Files
```
src/
  server.js
  routes/
    users.js
    posts.js
package.json
```

## Code Snippet
```javascript
// src/routes/users.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ take: 20 });
  res.json(users);
});

router.get('/:id/posts', async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { authorId: req.params.id },
  });
  res.json(posts);
});

module.exports = router;
```

## What We Learn
- REST forces the client to make multiple requests (`/users/1` then `/users/1/posts`).
- No schema contract: clients must read docs to know field names.
- Over-fetching: `SELECT *` returns fields the client may not need.

## Next Step
Add TypeScript (v2) so we can model domain types that will later become our GraphQL schema.
