# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

You need an endpoint that checks if JSON is valid. You write this:

```js
// server.js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/validate', (req, res) => {
  const data = JSON.parse(req.body);
  res.json({ valid: true, data });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

Wait — `express.json()` already parsed the body. So `JSON.parse(req.body)` is parsing an object, not a string. It throws `Unexpected token o in JSON at position 1`.

You fix it:

```js
app.post('/validate', (req, res) => {
  res.json({ valid: true, data: req.body });
});
```

**"This works. It returns the JSON back. Ship it."**

## The 3am Page

A user sends this:

```json
{
  "name": "",
  "email": "not-an-email",
  "age": "twenty-five"
}
```

Your code happily returns `{ valid: true, data: { ... } }`. The downstream service stores `"twenty-five"` in a database column that expects an integer. The query fails. The downstream service crashes. They call you at 3am asking why your "validator" approved garbage data.

You have no answer. You didn't validate. You just echoed.

## The Bug You Can't See

Later, someone adds a feature:

```js
app.post('/register', (req, res) => {
  const user = req.body;
  db.users.insert({
    name: user.nmae,  // <-- typo
    email: user.email,
  });
  res.json({ success: true });
});
```

Every user gets `null` for their name in the database. You don't notice for three days. There's no error — JavaScript just silently inserts `undefined` which the database converts to `null`. Your types would have caught this. But you don't have types.

## What We Have

- **No validation** — anything goes, corrupted data downstream
- **No types** — typos cost database migrations
- **No error format** — clients get HTML 500 pages, not actionable JSON
- **No tests** — regressions ship to production

## What We Need

We need to catch our own bugs with types, and we need to catch user bugs with validation. Two different weapons for two different enemies.
