# A06 Evolution: v1 — Simple JavaScript

## State of the System

The content moderation pipeline starts as a single-file Express application in plain JavaScript. There is no typing, no validation, and no structured architecture. The entire system fits in `index.js`.

## What Works

- `POST /content/submit` — accepts `{ userId, text }` and stores it in a global `contentMap`.
- `POST /content/:id/review` — a human reviewer sends `{ decision: "approved" | "rejected" }` and the content status updates in-place.
- `POST /content/:id/publish` — flips status to `published` if `approved`.

## What Does NOT Work

- **No AI layer.** Every piece of content sits in the map waiting for a human. At 1,000 submissions per hour, the queue overwhelms the review team.
- **No audit trail.** Once a status changes, the previous value is gone forever. Compliance teams have no history to inspect.
- **Race conditions.** Two reviewers can POST to the same `id` simultaneously. Because `contentMap.get(id)` is read, then written back, the last write wins silently.
- **No input validation.** A missing `userId` causes `undefined` to be stored. A missing `text` stores an empty string. There are no error responses — just silent corruption.

## Code Snapshot (index.js)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const contentMap = new Map();

app.post('/content/submit', (req, res) => {
  const id = `cnt_${Date.now()}`;
  contentMap.set(id, { ...req.body, status: 'submitted' });
  res.json({ id });
});

app.post('/content/:id/review', (req, res) => {
  const content = contentMap.get(req.params.id);
  content.status = req.body.decision; // mutates in place, no check
  res.json(content);
});
```

## Architectural Notes

This is the "manual review" stage. Every decision is made by a human, and the system provides nothing more than a shared in-memory dictionary. The data model is implicit: we know a content item has `userId`, `text`, and `status` only by reading the handlers.

## Migration Path to v2

1. Extract the implicit data model into TypeScript interfaces (`ContentItem`, `HumanDecision`).
2. Split routes into dedicated modules (`content.js`, `human-review.js`).
3. Introduce an `AIResult` placeholder so the pipeline can grow beyond human-only review.
