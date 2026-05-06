# v1-simple-js.md — UUID Generator

## The Naive Beginning

We needed unique identifiers for resources. The simplest approach: `Math.random()`:

```javascript
// server.js
const express = require('express');
const app = express();

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isValidUUID(uuid) {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}

app.post('/generate', (req, res) => {
  res.json({ uuid: generateUUID() });
});

app.get('/validate/:uuid', (req, res) => {
  res.json({ uuid: req.params.uuid, valid: isValidUUID(req.params.uuid) });
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** This "UUID" is predictable and the validation is useless:

1. **Predictable generation:** `Math.random()` is NOT cryptographically secure. It's a pseudo-random number generator with a deterministic seed. An attacker who observes a few UUIDs can predict future ones, leading to session hijacking or unauthorized access to resources.
2. **Weak validation:** The regex `/^[0-9a-f-]{36}$/i` accepts complete garbage:
   ```javascript
   isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg'); // true!
   isValidUUID('not-even-close');                         // false
   ```
   It doesn't enforce the UUID version (`4`) or variant bits (`8|9|a|b`).

## Why We Added Complexity

We needed:
- **Cryptographically secure randomness** so UUIDs are unpredictable
- **Strict validation** that enforces version and variant bits
- **Multiple UUID formats** (v4, v7, ULID) for different use cases

> **Lesson:** `Math.random()` is for games and animations, not security. A "UUID" that an attacker can predict is just a fancy sequential ID.
