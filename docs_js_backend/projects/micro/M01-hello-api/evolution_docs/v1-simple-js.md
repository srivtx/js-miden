# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

You need an API. You Google "express hello world" and copy the first Stack Overflow answer.

```js
// server.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

That's it. Seven lines. You run `node server.js`, open `http://localhost:3000`, and you see the string.

**"This works. It returns 'Hello World'. Ship it."**

## The 3am Page

Two weeks later, the phone rings. The frontend team says the API is down. You check the server — it's running. You ask for the error message. They don't have one. You check your terminal where you ran `node server.js`.

It's gone. You closed the laptop yesterday and the process died.

You restart it. Everything works. You shrug and go back to bed.

## The Bug You Can't See

A month later, a user reports that sometimes requests are slow. You have no data. `console.log` only printed the boot message. You add some logs:

```js
app.get('/', (req, res) => {
  console.log('Got a request');
  res.send('Hello, World!');
});
```

Now your terminal is a wall of undifferentiated text. You can't tell which log came from which request. Two requests came in at the same time and their `console.log` lines interleaved. You can't search this. You can't aggregate it. You can't tell if the slowness is in your code, the network, or the database.

You also shipped this small change last week:

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestmap: new Date().toISOString() });
});
```

Notice the typo: `timestmap`. TypeScript would have caught that. But you don't have TypeScript. You have JavaScript. The endpoint returns `{ timestmap: "..." }` and the load balancer thinks the health check is failing because it expects a `timestamp` field. The load balancer starts routing traffic away from your server. You don't find out until traffic drops to zero.

This is the pain of "it works on my machine."

## What We Have

- **CommonJS** (`require` / `module.exports`)
- **No types** — typos become production bugs
- **No validation** — anything the client sends is accepted
- **`console.log`** — unstructured, unsearchable, loses context
- **No tests** — every change is a gamble
- **No request IDs** — can't trace a single request through the system

## What We Need

Each of these is a lesson in blood. We'll add them one at a time, and each time we'll start with the bug that made us do it.
