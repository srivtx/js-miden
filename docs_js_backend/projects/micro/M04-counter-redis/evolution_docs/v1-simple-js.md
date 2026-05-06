# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

You need a counter API. The simplest possible version:

```js
// server.js
const express = require('express');
const app = express();

let count = 0;

app.post('/increment', (req, res) => {
  count = count + 1;
  res.json({ count });
});

app.get('/count', (req, res) => {
  res.json({ count });
});

app.listen(3000, () => {
  console.log('Counter API on port 3000');
});
```

**"This works. It counts. Ship it."**

## The 3am Page

You deploy to production with two server instances behind a load balancer. A user posts to `/increment` three times. The count goes from 0 to 1. They refresh. It's 1. They expected 3.

Each server has its own `let count = 0`. They don't share state. Your "counter" is actually two counters, and the user sees whichever one the load balancer picked.

You add a file:

```js
const fs = require('fs');
const COUNTER_FILE = './counter.txt';

function readCount() {
  try {
    return parseInt(fs.readFileSync(COUNTER_FILE, 'utf8'), 10);
  } catch {
    return 0;
  }
}

app.post('/increment', (req, res) => {
  const current = readCount();
  fs.writeFileSync(COUNTER_FILE, String(current + 1));
  res.json({ count: current + 1 });
});
```

Now both servers share the file. But under load, two requests read `5` at the same time, both write `6`. You lost an increment. The race condition is real and silent.

## The Bug You Can't See

Even the file-based version has a deeper problem. The read and write are two separate system calls. Between them, another process can read the same value. On a busy API, you're losing 5-10% of increments and you have no idea.

Also, the file system becomes your bottleneck. Every request waits for disk I/O. Your beautiful in-memory Node.js app is now slower than a PHP script.

## What We Have

- **In-memory state** — lost on restart, not shared across instances
- **File-based state** — shared but racy, slow, corruptible
- **No atomicity** — read-modify-write is a concurrency trap
- **No Redis** — no centralized, fast, atomic counter

## What We Need

A real distributed counter. Redis. And atomic operations so increments never collide.
