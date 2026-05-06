# S18 A/B Testing — v1 Simple JS

## The Naive Beginning

You need A/B testing. The simplest thing: random assignment.

```js
// server.js
const express = require('express');
const app = express();
app.use(express.json());

app.get('/experiments/:name', (req, res) => {
  const variant = Math.random() < 0.5 ? 'A' : 'B';
  res.json({ experiment: req.params.name, variant });
});

app.listen(3000);
```

**"This works. Random assignment is fair. Ship it."**

## The Pain in Production

### 1. Inconsistent Experience

User Alice visits your site. She gets variant A. She refreshes. She gets variant B. She buys on variant A. You don't know which variant converted her because she saw both.

### 2. No User Tracking

You assign variants but don't record who got what. At analysis time, you can't attribute conversions to variants. Your experiment is worthless.

### 3. No Control Group

Every user gets a treatment. You have no baseline to compare against. Is variant B better, or was it just a good week? You can't tell.

### 4. No Statistical Significance

Variant A: 100 users, 5 conversions (5%). Variant B: 100 users, 7 conversions (7%). Is B better? Maybe. Maybe it's noise. You have no p-value. You ship B and it performs worse.

## What We Have

- **Random assignment** — users see different variants on every visit
- **No persistence** — can't attribute conversions
- **No control group** — no baseline comparison
- **No statistics** — can't distinguish signal from noise

## What v2 Fixes

Consistent assignment. Hash user ID so the same user always gets the same variant.
