# v1 — Simple JS (Naive Note API)

## The Scenario

It's 2am. Your junior built a note-taking API. "It's just CRUD with Postgres," they say. You see the string concatenation and pour more coffee.

## The PAIN: SQL Injection and No Search

```javascript
// server.js
const express = require('express');
const { Client } = require('pg');
const app = express();
app.use(express.json());

const client = new Client({ database: 'notes' });
client.connect();

app.post('/notes', async (req, res) => {
  const { title, content } = req.body;
  const result = await client.query(
    `INSERT INTO notes (title, content) VALUES ('${title}', '${content}') RETURNING *`
  );
  res.status(201).json(result.rows[0]);
});

app.get('/notes', async (req, res) => {
  const result = await client.query('SELECT * FROM notes');
  res.json(result.rows);
});

app.listen(3000);
```

### What breaks in production:

1. **SQL injection**: `title: "'); DROP TABLE notes; --"` — your query becomes:
   ```sql
   INSERT INTO notes (title, content) VALUES (''); DROP TABLE notes; --', '...')
   ```
   Your notes table is gone. All data is gone. Your backups were from last month because "we'll set up automated backups next sprint."

2. **No search**: Users have 500 notes. They want to find "recipe." Your API returns all 500 and tells them to use Ctrl+F. In a mobile app.

3. **No pagination**: `SELECT * FROM notes` with 10,000 rows. JSON stringification blocks the event loop for 2 seconds. All other requests wait.

4. **No soft delete**: User accidentally deletes their thesis notes. "Can you restore it?" No. It's `DELETE FROM notes WHERE id = 1`. Gone forever.

5. **No types**: `req.body.titel` is undefined. Your INSERT becomes `VALUES ('undefined', '...')`. The user sees a note titled "undefined."

### The moment of realization:

> Junior: "Why is the notes table missing?"
> 
> You: "Because we let users write SQL. We just didn't tell them they could."

## Why we start here

This is the classic "I know SQL, I'll just write queries" approach. It works until it doesn't. SQL injection is a top-3 security vulnerability year after year, not because it's hard to prevent, but because string concatenation feels so natural. We keep this version to remember: **never trust user input in SQL. Ever.**

## The fix (next version)

We need to describe our data shapes before we can safely query them. TypeScript time.
