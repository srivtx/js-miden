# MD13 Event Sourcing + CQRS — v1 Simple JS

## Overview
A traditional CRUD Express app in plain JavaScript. Orders are stored in a single `orders` table. Updates overwrite state; there is no history, no audit trail, and no separation between reads and writes.

## Files
```
src/
  server.js
  routes/
    orders.js
package.json
```

## Code Snippet
```javascript
// src/routes/orders.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  const order = await prisma.order.create({ data: req.body });
  res.status(201).json(order);
});

router.patch('/:id', async (req, res) => {
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(order);
});

module.exports = router;
```

## What We Learn
- CRUD is simple but destructive: the previous state of an order is lost forever.
- Reads and writes share the same schema, forcing compromises on indexing and normalization.

## Next Step
Add TypeScript (v2) so we can model domain events and read/write separation.
