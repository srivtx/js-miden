# v1-simple-js

## Goal
Shorten a URL and redirect using an in-memory store.

## Code

```js
// src/index.js
const express = require('express');
const app = express();
app.use(express.json());

const urls = new Map();
let counter = 0;

app.post('/shorten', (req, res) => {
  const code = `${++counter}`;
  urls.set(code, req.body.url);
  res.json({ shortCode: code, url: req.body.url });
});

app.get('/:code', (req, res) => {
  const url = urls.get(req.params.code);
  if (!url) return res.status(404).json({ error: 'Not found' });
  res.redirect(url);
});

app.listen(3000, () => console.log('Shortener on 3000'));
```

## Decisions
- In-memory `Map` — fastest lookup, zero DB setup.
- Sequential integer codes — easiest to read and debug.

## Risks
- Sequential codes leak creation order and volume.
- No persistence — restart wipes everything.
- No collision handling — `counter` resets on restart, causing overwrites.
- No URL validation — can shorten `javascript:alert(1)`.
