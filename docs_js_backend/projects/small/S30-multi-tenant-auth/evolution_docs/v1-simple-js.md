# v1-simple-js

## Goal
Register and log in users with a single hard-coded tenant.

## Code

```js
// src/index.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

const users = [];
const JWT_SECRET = 'dev-secret';

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  users.push({ email: req.body.email, password_hash: hash });
  res.status(201).json({ email: req.body.email });
});

app.post('/login', async (req, res) => {
  const user = users.find(u => u.email === req.body.email);
  if (!user || !await bcrypt.compare(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.listen(3000, () => console.log('Auth on 3000'));
```

## Decisions
- In-memory array — zero DB setup.
- Single tenant — every user lives in the same namespace.
- Plain JWT with email as `userId`.

## Risks
- No tenant isolation — one tenant's users leak into another if code changes.
- Hard-coded secret — rotate in production.
- No role checks — every user is an admin by default.
