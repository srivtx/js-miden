# S20 API Versioning — v1 Simple JS

## The Naive Implementation

You have a simple user API. No versioning needed — just ship it:

```js
// app.js
const express = require('express');
const app = express();

const users = [
  { id: '1', name: 'Alice Johnson' },
  { id: '2', name: 'Bob Smith' },
];

app.get('/users', (req, res) => {
  res.json(users);
});

app.listen(3000);
```

Works locally:
```bash
curl http://localhost:3000/users
# → [{ "id": "1", "name": "Alice Johnson" }]
```

## The Pain in Production

### 1. Breaking Changes Kill Clients

Your mobile app expects `{ name }`. You decide names should be split:

```js
app.get('/users', (req, res) => {
  res.json(users.map(u => ({
    id: u.id,
    firstName: u.name.split(' ')[0],
    lastName: u.name.split(' ')[1],
  })));
});
```

Every existing client breaks. `user.name` is now `undefined`. The mobile app crashes on launch. Your API just performed a distributed denial-of-service against your own user base.

### 2. No Deprecation Path

Clients have no idea the API changed. There's no warning, no sunset date, no migration guide. They find out when their app crashes in production.

### 3. No Version Discovery

A new developer joins. They look at `/users`. Which version is this? V1? V2? The current version? There's no way to know without reading the source code.

### 4. Forced Upgrades

Every client must upgrade simultaneously. You can't roll out a new format gradually. You can't A/B test the new schema. It's all-or-nothing.

## The Lesson

An API without versioning is a ticking time bomb. The first breaking change will break every client in production.

## What v2 Fixes

TypeScript. Before we build versioning, let's get the types right.
