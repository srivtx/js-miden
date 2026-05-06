# v1 — Simple JS (Naive Todo API)

## The Scenario

It's 2am. Your junior just deployed their first API. "It works on my machine!" they say. You know how this ends.

## The PAIN: In-Memory Array

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const todos = []; // <-- This is the bug. This is always the bug.

app.get('/todos', (req, res) => {
  res.json(todos);
});

app.post('/todos', (req, res) => {
  const todo = {
    id: todos.length + 1,
    title: req.body.title,
    done: false,
  };
  todos.push(todo);
  res.status(201).json(todo);
});

app.listen(3000);
```

### What breaks in production:

1. **Data loss on restart**: The array lives in Node's heap. Deploy a new version? Every todo vanishes. PM2 cluster mode? Each worker has its own array. Request hits worker A, next request hits worker B — "Where did my todo go?!"

2. **No validation**: `POST /todos` with `{}` creates `{ id: 1, title: undefined, done: false }`. Your database (if you had one) is now a graveyard of garbage.

3. **ID collisions**: `todos.length + 1` breaks on delete. Delete todo #2, add a new one — you now have two todos with id 3.

4. **No error handling**: Express default error handler dumps stack traces to the client in production. Attackers love reading your file paths.

5. **No types**: `req.body.titel` compiles fine. Runs fine. Stores `undefined` forever. You only find out when a user emails you asking why their todo has no title.

### The moment of realization:

> Junior: "Why did all the todos disappear after I restarted the server?"
> 
> You: "Because RAM is called volatile for a reason."

## Why we start here

This is how every developer builds their first API. It's simple. It works. And it's completely unsuitable for production. We keep this version to remember the pain — so we understand why every layer we add exists.

## The fix (next version)

We need persistence. But not just any persistence — we need to feel the pain of the *next* naive solution before we appreciate the right one.
