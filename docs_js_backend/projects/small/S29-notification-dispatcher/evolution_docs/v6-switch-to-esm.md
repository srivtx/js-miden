# v6-switch-to-esm

## Goal
Move to ESM for clean imports and future-proofing.

## Changes
1. `"type": "module"` in `package.json`.
2. All imports use `.js` extension.
3. Use top-level `await` for channel initialization (e.g., Redis/WebSocket).

## Code

```ts
// src/services/channels/websocket.ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

export const websocketChannel = {
  async send(userId: string, content: string) {
    // broadcast to connected clients filtered by userId
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(JSON.stringify({ userId, content }));
    });
    return { channel: 'inapp', status: 'sent' };
  }
};
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

## Decisions
- `ws` library supports ESM natively.
- `tsx` handles TypeScript + ESM transparently in dev.

## Risks
- Some channel libraries (older Twilio SDK versions) may have CJS-only issues. Test each channel after migration.
