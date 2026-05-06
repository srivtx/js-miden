# v6 — Switch to ESM (Chat Rooms)

## The Scenario

It's 2am. Your junior wants to add `ws` (the fast WebSocket library) alongside Socket.IO for a performance comparison. "It's ESM-only," they say. Their CommonJS project can't import it. They're stuck with Socket.IO only.

## The PAIN: Real-Time Libraries Are ESM-Native

From v5:

```typescript
// Socket.IO works in both CJS and ESM,
// but many newer real-time tools don't:

import { WebSocketServer } from 'ws'; // ESM-only in recent versions
```

Real-time systems often need multiple transport layers (WebSocket, SSE, long-polling). Being stuck in CommonJS limits your architectural choices.

## The Solution: ESM for Real-Time

### 1. package.json

```json
{
  "name": "s06-chat-rooms",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 3. Source files

```typescript
// src/index.ts
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { setupSockets } from './socket.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(join(__dirname, '../public')));

const httpServer = createServer(app);
const io = new Server(httpServer);

setupSockets(io);

const PORT = process.env.PORT || 3000;
export const server = httpServer.listen(PORT, () => {
  console.log(`S06 Chat Rooms listening on ${PORT}`);
});

export { app, io };
```

```typescript
// src/socket.ts
import type { Server, Socket } from 'socket.io';

const rooms = new Map<string, Set<string>>();

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ... socket handlers
  });
}
```

### 4. The `__dirname` pattern in ESM

```typescript
// Every ESM project that serves static files needs this:
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

It's boilerplate. It's also explicit about where the path comes from (`import.meta.url` is the module's URL, not some magic global).

## The PAIN of Socket.IO Client in Tests

```typescript
// tests/chat.test.ts
import { io as Client } from 'socket.io-client';
// Works in ESM because socket.io-client exports named exports

// In CommonJS, this often required:
const Client = require('socket.io-client');
// Different import style, different intellisense
```

ESM imports are consistent between source and test files.

## ESM Evolution in Chat Rooms

| Version | Module system | Real-time flexibility |
|---------|--------------|----------------------|
| v1-5 | CommonJS | ❌ Limited transport options |
| v6 | ESM | ✓ Can mix WebSocket, SSE, Socket.IO |

## The Realization

> Junior: "I keep writing `const __dirname = ...` in every ESM file. Is there a better way?"
> 
> You: "Not yet. TC39 is working on `import.meta.dirname` but it's not standard. For now, the boilerplate is the price of correctness. At least it's explicit — every developer who reads it knows exactly where the path comes from."

## The Next PAIN

ESM works. But your chat rooms exist only in server memory. Restart the server? All room state is lost. Users are suddenly not in any room. Messages have no history. "What did they say?" — we don't know.

## Next: v7 — Production Setup
