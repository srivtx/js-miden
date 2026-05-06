# v6 — Switching to ESM

You're trying to integrate `ws` (WebSocket library) for real-time bidding. It's ESM-first in newer versions.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ws not supported
```

Your monolith is CommonJS. Every modern real-time library is ESM. Time to switch.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// app.ts
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Handle real-time bid messages
  });
});

server.listen(3000);
```

## Why ESM?

- **Modern libraries work** — `ws`, `undici`, ESM-only packages
- **Top-level await** — clean async initialization for Redis, DB connections
- **Static analysis** — bundlers can tree-shake when you eventually split services
- **`node:` prefixes** — clear built-in vs npm imports

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Replace `__dirname` with `import.meta.url`

**Next:** Production setup — splitting the monolith into services.
