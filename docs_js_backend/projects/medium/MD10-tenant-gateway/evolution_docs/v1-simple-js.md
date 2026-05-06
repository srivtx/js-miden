# MD10 Multi-Tenant Gateway — v1 Simple JS

> **Motto**: One app, many users, zero isolation.

## What Built

A single-file Express app in JavaScript. One route: `GET /api/data` returns the same data for every request. No tenant concept. No auth. No rate limiting. Global state.

## Why Start Here

- **Speed**: See a response in 5 lines of code
- **Clarity**: Understand the request/response shape before adding isolation
- **Baseline**: Every later feature (auth, RLS, schema-per-tenant) must justify its complexity

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express (JS)   │─────▶│  In-Memory      │
│  (Company)  │◀─────│  /api/data      │◀─────│  Global State   │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```javascript
// server.js
const express = require('express');

const app = express();
app.use(express.json());

const data = [];

app.get('/api/data', (req, res) => {
  res.json({ data });
});

app.post('/api/data', (req, res) => {
  data.push(req.body);
  res.status(201).json(req.body);
});

app.listen(3000, () => console.log('Gateway v1 on :3000'));
```

## Problems We Accepted

- No tenant isolation — every user sees every company's data
- No auth — anyone can read or write
- No rate limiting — a single client can DDoS the server
- No logging — `console.log` only
- No tests — we hope it works

## Checklist

- [ ] Data is stored in a global JavaScript array
- [ ] No tenant concept
- [ ] No auth or rate limiting
- [ ] No database or Redis dependency

## Next Step

Add TypeScript so we stop guessing what `req.body` contains.
