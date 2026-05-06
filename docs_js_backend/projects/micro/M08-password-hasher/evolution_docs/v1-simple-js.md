# v1-simple-js.md — Password Hasher

## The Naive Beginning

We needed an endpoint to hash passwords. The simplest thing that works:

```javascript
// server.js
const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

app.post('/hash', (req, res) => {
  const { password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});

app.post('/verify', (req, res) => {
  const { password, hash } = req.body;
  const computed = crypto.createHash('sha256').update(password).digest('hex');
  const match = computed === hash;
  res.json({ match });
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** Two critical security flaws exist but the code "works" in manual testing:

1. **No salt, fast hash:** SHA-256 is designed to be fast. Identical passwords produce identical hashes. An attacker can pre-compute a rainbow table of common passwords and crack millions in seconds on a GPU.
2. **Timing attack:** `===` short-circuits on the first differing byte. An attacker can measure response times and guess the hash byte-by-byte.

```bash
curl -X POST http://localhost:3000/hash -d '{"password":"secret"}'
# { "hash": "2bb80d5..." }

curl -X POST http://localhost:3000/hash -d '{"password":"secret"}'
# { "hash": "2bb80d5..." }  ← identical! attacker's dream
```

## Why We Added Complexity

We needed:
- A **slow, salted hash** (bcrypt/Argon2) so rainbow tables are useless
- **Constant-time comparison** so timing side-channels are closed

> **Lesson:** "It works" is not "it's secure." Security bugs don't crash the server; they silently expose user data.
