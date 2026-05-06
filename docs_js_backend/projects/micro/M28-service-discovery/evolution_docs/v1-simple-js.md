# v1: Simple JS — Service Discovery

## The Pain

Your frontend calls services by hardcoded URL:

```javascript
// frontend.js
const userService = 'http://localhost:3001';
const orderService = 'http://localhost:3002';
```

You deploy to staging. The services are on ports 4001 and 4002. You change the URLs. You deploy to production. The services are on ports 5001 and 5002. You change the URLs again. You have 3 versions of the frontend for 3 environments.

Then you scale. You run 3 instances of user-service on ports 3001, 3002, 3003. The frontend only knows 3001. It hits one server with 100% of traffic while the other two sit idle.

## The Solution (v1)

Build a simple in-memory registry.

```javascript
// src/registry.js
const registry = [];

function registerService(name, url) {
  const service = {
    id: Math.random().toString(36).slice(2),
    name,
    url,
    registeredAt: Date.now(),
  };
  registry.push(service);
  return service;
}

function getServices(name) {
  return registry.filter(s => s.name === name);
}

module.exports = { registerService, getServices, registry };
```

```javascript
// src/index.js
const express = require('express');
const { registerService, getServices } = require('./registry');

const app = express();
app.use(express.json());

app.post('/register', (req, res) => {
  const { name, url } = req.body;
  const service = registerService(name, url);
  res.status(201).json(service);
});

app.get('/discover/:name', (req, res) => {
  const services = getServices(req.params.name);
  res.json(services);
});

app.listen(3000, () => {
  console.log('Service discovery running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `name` and `url` are untyped. `url: 3001` is accepted.
- **No validation**: `name: ""` breaks Express routing.
- **No heartbeats**: Dead services stay in the registry forever.
- **No TTL cleanup**: The registry grows unbounded.
- **No logging**: You can't audit registrations.
- **No tests**: Refactoring registry logic is risky.
- **CJS**: `require()` is legacy.
- **No graceful shutdown**: Services don't unregister on exit.
- **No replication**: Registry is in-memory; restart = data loss.

This is v1. It solves the "hardcoded URLs in 12 files" pain. It introduces new pains that v2-v7 will fix.
