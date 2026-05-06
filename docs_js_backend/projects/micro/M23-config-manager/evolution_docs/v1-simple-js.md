# v1: Simple JS — Config Manager

## The Pain

You need to change the API timeout. It's hardcoded:

```javascript
// src/api.js
const TIMEOUT = 5000;
```

You deploy. Product says: "Make it 10 seconds for the enterprise client." You change it, deploy again. Then support says: "The small client needs 3 seconds." You now have:

```javascript
const TIMEOUT = process.env.CLIENT === 'enterprise' ? 10000 : 3000;
```

Then you add 10 more config values. Your `src/api.js` has 50 lines of hardcoded constants. You want to change `db.host` for staging. You grep for `DB_HOST`. You find it in `src/api.js`, `src/db.js`, `src/cache.js`, and `tests/setup.js`. You change 3 of them. The 4th stays wrong. Staging connects to production.

## The Solution (v1)

Extract config to a JSON file and a simple manager.

```javascript
// src/config-manager.js
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = path.resolve(configPath);
    this.cache = new Map();
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache = new Map(Object.entries(parsed));
    } catch {
      this.cache = new Map();
    }
  }

  async save() {
    const obj = Object.fromEntries(this.cache);
    await fs.writeFile(this.configPath, JSON.stringify(obj, null, 2));
  }

  get(key) {
    return this.cache.get(key);
  }

  async set(key, value) {
    this.cache.set(key, value);
    await this.save();
  }
}

module.exports = { ConfigManager };
```

```javascript
// src/index.js
const express = require('express');
const { ConfigManager } = require('./config-manager');

const app = express();
app.use(express.json());

const manager = new ConfigManager('./config.json');
manager.load();

app.get('/config/:key', (req, res) => {
  const value = manager.get(req.params.key);
  if (value === undefined) {
    return res.status(404).json({ error: 'Config key not found' });
  }
  res.json({ key: req.params.key, value });
});

app.post('/config', async (req, res) => {
  const { key, value } = req.body;
  await manager.set(key, value);
  res.json({ key, value });
});

app.listen(3000, () => {
  console.log('Config manager running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `manager.set('timeout', 'infinite')` is accepted.
- **No validation**: `port: 999999` is stored without complaint.
- **No atomic writes**: A crash during `fs.writeFile` leaves a 0-byte file.
- **No logs**: You can't audit who changed what.
- **No tests**: Refactoring the save logic is risky.
- **CJS**: `require()` and `module.exports` are legacy.
- **No hot reload**: Changing `config.json` requires a restart.

This is v1. It solves the "constants scattered in 12 files" pain. It introduces new pains that v2-v7 will fix.
