# MD05 Collaborative Whiteboard — v6 Switching to ESM

## The Problem

You're trying to use `yjs` for CRDT operations. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module yjs not supported
```

`yjs` is the gold standard for collaborative editing CRDTs. Without it, you'd have to implement operational transforms from scratch. That's months of work and subtle bugs.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

```ts
// src/crdt/yjsAdapter.ts
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export class YjsWhiteboard {
  private doc = new Y.Doc();
  private strokes = this.doc.getArray<Y.Map<unknown>>('strokes');

  addStroke(stroke: Stroke): void {
    const yStroke = new Y.Map();
    yStroke.set('id', stroke.id);
    yStroke.set('points', JSON.stringify(stroke.points));
    yStroke.set('color', stroke.color);
    yStroke.set('width', stroke.width);
    yStroke.set('tool', stroke.tool);
    yStroke.set('userId', stroke.userId);
    this.strokes.push([yStroke]);
  }

  deleteStroke(strokeId: string): void {
    const index = this.strokes.toArray().findIndex(s => s.get('id') === strokeId);
    if (index >= 0) this.strokes.delete(index, 1);
  }

  getState(): WhiteboardState {
    return {
      strokes: this.strokes.toArray().map(s => ({
        id: s.get('id') as string,
        points: JSON.parse(s.get('points') as string),
        color: s.get('color') as string,
        width: s.get('width') as number,
        tool: s.get('tool') as string,
        userId: s.get('userId') as string,
      })),
    };
  }
}
```

```ts
// src/index.ts
import { WebSocketServer } from 'ws';
import { YjsWhiteboard } from './crdt/yjsAdapter.js';
import { WhiteboardService } from './services/whiteboardService.js';
import { PostgresBoardRepository } from './repos/postgresBoardRepo.js';
import { RedisPubSub } from './pubsub/redisPubSub.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const service = new WhiteboardService(
  new PostgresBoardRepository(prisma),
  new RedisPubSub(),
  new YjsWhiteboard(),
);
```

## Why ESM Matters for This Project

### 1. Yjs Tree-Shaking

```ts
import * as Y from 'yjs';
```

Yjs is modular. ESM lets bundlers drop unused CRDT types.

### 2. Dynamic Provider Loading

```ts
// Load WebRTC provider only in production
if (process.env.ENABLE_WEBRTC === 'true') {
  const { WebrtcProvider } = await import('y-webrtc');
  const provider = new WebrtcProvider('whiteboard-room', ydoc);
}
```

No unnecessary dependencies in test environments.

### 3. Top-Level Await for Board Hydration

```ts
// src/index.ts
const boardIds = await service.loadActiveBoards();
for (const id of boardIds) {
  await service.hydrateBoard(id);
}
```

Server doesn't accept connections until all boards are ready.

## Migration Checklist

- [ ] Add `"type": "module"` to `package.json`
- [ ] Use `.js` extensions in imports
- [ ] Use `node:` prefix for built-ins
- [ ] Update `tsconfig.json` for `NodeNext`
- [ ] Switch test runner to Vitest

## The Bug

You switch to ESM. Your WebSocket library (`ws`) has mixed ESM/CJS types. TypeScript complains about default imports.

**Fix:** Use named imports.

```ts
import { WebSocketServer, WebSocket } from 'ws';
```

Not:
```ts
import WebSocket from 'ws'; // Breaks in ESM
```

**Next:** Production setup with Redis pub/sub, CRDT persistence, and session replay.
