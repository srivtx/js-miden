# S14 Search API — v1 Simple JS

## The Naive Beginning

You need search. The simplest thing: no search at all, or filter in memory.

```js
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const documents = [];

app.post('/index', (req, res) => {
  documents.push(req.body);
  res.status(201).json({ id: documents.length });
});

app.get('/search', (req, res) => {
  const q = req.query.q;
  // No search at all — just return everything
  res.json({ results: documents });
});

app.listen(3000);
```

**"Search? Just return all documents. The client can filter. Ship it."**

## The Pain in Production

### 1. No Search Capability

Users type "graphql" and get every document in the database. They can't find anything. Your search endpoint is useless.

### 2. In-Memory Storage

Documents live in a JavaScript array. Restart the server? All data is gone. No persistence, no indexing.

### 3. No Pagination

Return 10,000 documents in a single response. The JSON is 50MB. The client times out. The server runs out of memory.

### 4. Case Sensitivity

Search for "GraphQL" and miss "graphql". Search for "api" and miss "API". Users get inconsistent results.

## What We Have

- **No search** — returns all documents
- **No persistence** — in-memory array
- **No pagination** — unbounded responses
- **No indexing** — O(n) scan every time

## What v2 Fixes

SQL LIKE. Basic string matching in the database.
