# v1: Simple JS — Feature Flag Service

## The Pain

You need to hide a new feature from users until it's ready. You hardcode a boolean:

```javascript
// src/index.js
const express = require('express');
const app = express();

const DARK_MODE_ENABLED = true;

app.get('/flags/dark-mode', (req, res) => {
  res.json({ flag: 'dark-mode', enabled: DARK_MODE_ENABLED });
});

app.listen(3000);
```

It works. Then product says: "Only show it to 10% of users." You change the code:

```javascript
app.get('/flags/dark-mode', (req, res) => {
  const enabled = Math.random() < 0.1;
  res.json({ flag: 'dark-mode', enabled });
});
```

A user refreshes the page. The flag flips from `true` to `false`. They tweet: "Your site is broken." Product is angry. Engineering is embarrassed.

Then product says: "Make sure user-123 always sees it." You add:

```javascript
app.get('/flags/dark-mode', (req, res) => {
  const userId = req.query.userId;
  if (userId === 'user-123') {
    res.json({ flag: 'dark-mode', enabled: true });
    return;
  }
  const enabled = Math.random() < 0.1;
  res.json({ flag: 'dark-mode', enabled });
});
});
```

Now you have 5 features, each with copy-pasted logic. You want to turn off `new-checkout`. You grep for `NEW_CHECKOUT_ENABLED`. You find it in 12 files. You miss one. The feature stays on for 3 days until a user finds a bug.

## The Solution (v1)

Extract flags to a simple in-memory map. One source of truth.

```javascript
// src/index.js
const express = require('express');
const app = express();
app.use(express.json());

const flags = new Map();

// Seed flags
flags.set('dark-mode', { enabled: true, rolloutPercent: 10 });
flags.set('new-checkout', { enabled: false, rolloutPercent: 0 });

app.get('/flags/:flag', (req, res) => {
  const flag = flags.get(req.params.flag);
  if (!flag) {
    return res.json({ flag: req.params.flag, enabled: false });
  }

  let enabled = flag.enabled;
  if (enabled && flag.rolloutPercent > 0) {
    enabled = Math.random() * 100 <= flag.rolloutPercent;
  }

  res.json({ flag: req.params.flag, enabled });
});

app.post('/flags/:flag', (req, res) => {
  const { enabled, rolloutPercent } = req.body;
  flags.set(req.params.flag, { enabled, rolloutPercent });
  res.json({ flag: req.params.flag, enabled, rolloutPercent });
});

app.listen(3000, () => {
  console.log('Feature flag service running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **Random rollout**: Same user gets different results on every request. No consistency.
- **No types**: `rolloutPercent` vs `rolloutPercentage` is a silent typo.
- **No validation**: `rolloutPercent: 150` is accepted.
- **No logs**: You can't audit who saw what.
- **No tests**: Refactoring is terrifying.
- **CJS**: `require()` is 2010. ESM is 2025.
- **No env config**: Changing a flag requires a code deploy.

This is v1. It solves the "hardcoded booleans in 12 files" pain. It introduces new pains that v2-v7 will fix.
