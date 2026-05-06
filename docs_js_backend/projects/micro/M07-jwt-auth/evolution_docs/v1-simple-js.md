# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

You need users to log in. The simplest thing:

```js
// server.js
const express = require('express');
const app = express();

const users = new Map();

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  users.set(username, password);
  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const stored = users.get(username);
  if (stored === password) {
    res.json({ success: true, token: username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/protected', (req, res) => {
  const token = req.headers.authorization;
  if (users.has(token)) {
    res.json({ message: 'Secret data' });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.listen(3000, () => {
  console.log('Auth server on port 3000');
});
```

**"This works. Users log in and get a token. Ship it."**

## The 3am Page

Your database gets dumped. The attacker publishes a file called `users.csv` containing:

```
username,password
alice,hunter2
bob,password123
...
```

Plaintext passwords. Every user who reused that password on another site is now compromised on that site too. You get emails. You get tweets. You get a letter from a regulator.

You didn't hash the passwords because "it's just a demo app." Now it's a breach report.

## The Bug You Can't See

Even if you add a quick hash:

```js
const crypto = require('crypto');

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

This is broken. SHA-256 is a general-purpose hash, not a password hash. It's designed to be *fast*. An attacker with a GPU can try billions of passwords per second. You need bcrypt, Argon2, or PBKDF2 — algorithms specifically designed to be *slow*.

Also, your "token" is just the username. Anyone can set `Authorization: alice` and become Alice. There's no expiry, no signature, no verification.

## What We Have

- **Plaintext passwords** — breach = game over
- **Fast hashes** — brute-forceable in hours
- **No real tokens** — anyone can forge authentication
- **No expiry** — stolen credentials work forever
- **No refresh tokens** — users stay logged in forever or get kicked out arbitrarily

## What We Need

Real password hashing. Signed JWTs with expiry. Secure cookie transport. And refresh tokens so we can revoke access without making users log in every hour.
