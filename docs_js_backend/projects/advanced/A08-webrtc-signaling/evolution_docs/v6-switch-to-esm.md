# A08 Evolution: v6 — Switch to ESM

## State of the System

The WebRTC signaling server is now a pure ES module package. WebSocket imports use ESM, and dynamic imports enable conditional loading of Redis or TURN configuration.

## What Changed

- **`"type": "module"` in package.json.** All `.js` and `.ts` files are ES modules.
- **`ws` imported as ESM.** `import { WebSocketServer } from 'ws';` works natively.
- **`.js` extensions on all relative imports.** `import { SignalingService } from './services/SignalingService.js'`.
- **Dynamic imports for optional Redis adapter.** `const { createAdapter } = await import('@socket.io/redis-adapter');` enables horizontal scaling without loading Redis code at startup.
- **`tsx` for development.** `tsx watch src/index.ts` runs the server in ESM mode.

## What Still Breaks

- **Memory leak is not fixed by ESM.** `IceRelayService` still stores candidates forever.
- **No WSS.** The WebSocket server runs on `ws://`. ESM does not change the transport.
- **No horizontal scaling.** `SignalingService` uses in-memory Maps. ESM enables dynamic import of Redis, but it is not configured.
- **No TURN credentials.** The server relays ICE candidates but does not provide TURN server configuration to clients.

## Code Snapshot (src/index.ts)

```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { SignalingService } from './services/SignalingService.js';
import { RoomService } from './services/RoomService.js';
import { IceRelayService } from './services/IceRelayService.js';
import { PresenceService } from './services/PresenceService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
// ...
```

## Architectural Notes

This is the "ESM + scalability" stage. ES modules enable clean separation of services and dynamic loading of optional adapters. The server can be extended with Redis Pub/Sub for multi-instance scaling without changing the core signaling logic. However, the base implementation still leaks memory and lacks TLS.

## Migration Path to v7

1. Add Docker and docker-compose with `coturn` for TURN relay.
2. Add Redis Pub/Sub adapter for horizontal scaling.
3. Switch to `wss://` with TLS certificates.
4. Schedule cleanup for ICE candidates and stale presence.
