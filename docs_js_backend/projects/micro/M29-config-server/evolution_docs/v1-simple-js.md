# M29 Config Server — v1 Simple JS

## The Naive Beginning

You need a central place to store config. The simplest thing: a JSON file on disk.

```js
// server.js
const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

const CONFIG_FILE = './config.json';

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

app.get('/config/:app', (req, res) => {
  const cfg = readConfig();
  res.json(cfg[req.params.app] || {});
});

app.post('/config/:app', (req, res) => {
  const cfg = readConfig();
  cfg[req.params.app] = { ...cfg[req.params.app], ...req.body };
  writeConfig(cfg);
  res.json({ status: 'ok' });
});

app.listen(3000);
```

**"This works. It's just a JSON file. Ship it."**

## The Pain in Production

### 1. No Environment Isolation

```bash
curl -X POST http://localhost:3000/config/payments \
  -d '{"dbHost":"localhost","debug":true}'

curl http://localhost:3000/config/payments
# → { dbHost: "localhost", debug: true }
```

There's no `dev` vs `prod`. Every app has one global config object. A developer updating dev settings overwrites production. The next deploy pulls localhost credentials into prod.

### 2. Race Conditions on Writes

Two services POST config at the same time:

```
Service A reads config.json  →  { payments: { debug: false } }
Service B reads config.json  →  { payments: { debug: false } }
Service A writes { debug: true }  →  saved
Service B writes { apiKey: 'xyz' }  →  overwrites A's change
```

Last write wins. Changes are silently lost.

### 3. No Validation

```bash
curl -X POST http://localhost:3000/config/payments \
  -d '{"port":"not-a-number","timeout":-1}'
```

The file now contains garbage. The next time an app reads it, it crashes on `parseInt`.

### 4. No Audit Trail

Who changed the database password? When? You have no idea. The JSON file has no history.

## What We Have

- **File-based storage** — race conditions, no atomic updates
- **No environment dimension** — dev overwrites prod
- **No validation** — garbage in, garbage out
- **No versioning** — can't roll back a bad change
- **No encryption** — secrets in plaintext on disk

## What v2 Fixes

TypeScript. Before we solve the architecture, let's stop typos from turning `env` into `undefined`.
