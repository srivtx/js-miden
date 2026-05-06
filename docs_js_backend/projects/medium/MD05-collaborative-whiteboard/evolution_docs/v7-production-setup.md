# MD05 Collaborative Whiteboard — v7 Production Setup

Your whiteboard works. It has types, validation, logs, tests, and ESM. But real-time collaboration at scale is one of the hardest problems in distributed systems. Concurrent edits, network partitions, and massive state make this a deep systems challenge.

## Pain #1: In-Memory State Dies on Restart

The server restarts. The `board` array vanishes. Hours of collaborative work disappear. A design team loses a week's wireframes. They never use your product again.

**Evolution: In-Memory → PostgreSQL Persistence**

```prisma
// prisma/schema.prisma
model Whiteboard {
  id        String   @id @default(uuid())
  name      String
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  strokes   Stroke[]
  sessions  Session[]

  @@index([updatedAt])
}

model Stroke {
  id        String   @id @default(uuid())
  boardId   String
  points    Json     // [{ x, y, t }, ...]
  color     String
  width     Float
  tool      String
  userId    String
  seq       Int      // sequence number for ordering
  createdAt DateTime @default(now())
  deletedAt DateTime?

  board Whiteboard @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId, seq])
  @@index([boardId, createdAt])
}

model Session {
  id        String   @id @default(uuid())
  boardId   String
  userId    String
  events    Json[]   // replay log
  startedAt DateTime @default(now())
  endedAt   DateTime?

  board Whiteboard @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId, startedAt])
}
```

Every stroke is persisted. Boards survive restarts.

## Pain #2: Clients See Divergent State

User A draws a line. User B draws a line. Both broadcast. Due to network latency, the strokes arrive in different orders on each client. The boards diverge. One user sees the circle inside the square. The other sees the square inside the circle.

**Evolution: Basic Broadcast → Operational Transforms**

```ts
// src/crdt/operationalTransform.ts
export interface Op {
  type: 'stroke' | 'delete' | 'move';
  strokeId: string;
  payload: unknown;
  seq: number;
}

export function transformOp(op1: Op, op2: Op): Op {
  if (op1.type === 'delete' && op2.type === 'stroke') {
    // If op1 deletes a stroke that op2 references, op2 becomes a no-op
    if (op2.strokeId === op1.strokeId) {
      return { ...op2, type: 'noop' } as unknown as Op;
    }
  }

  if (op1.type === 'move' && op2.type === 'move') {
    // Concurrent moves: preserve both transformations
    return {
      ...op2,
      payload: composeMoves(op2.payload, op1.payload),
    };
  }

  return op2;
}

// Server applies ops in order, broadcasts transformed ops
class OpLog {
  private ops: Op[] = [];
  private seq = 0;

  apply(op: Op): Op {
    // Assign server sequence number
    const serverOp = { ...op, seq: ++this.seq };

    // Transform against all concurrent ops
    for (const existing of this.ops) {
      if (existing.seq !== op.seq) {
        serverOp = transformOp(existing, serverOp);
      }
    }

    this.ops.push(serverOp);
    return serverOp;
  }
}
```

Operational transforms guarantee that all clients converge to the same state, regardless of operation order.

## Pain #3: Single Server Can't Handle Global Users

You have users in New York, London, and Tokyo. All connect to one server in Virginia. Tokyo users have 200ms latency. The drawing feels sluggish. You scale to 4 servers. Users on different servers don't see each other's strokes.

**Evolution: Single Server → Redis Pub/Sub + CRDTs**

```ts
// src/pubsub/redisPubSub.ts
import Redis from 'ioredis';

export class RedisPubSub {
  private publisher = new Redis(process.env.REDIS_URL);
  private subscriber = new Redis(process.env.REDIS_URL);

  subscribe(boardId: string, handler: (msg: BoardMessage) => void): void {
    const channel = `board:${boardId}`;
    this subscriber.subscribe(channel);
    this subscriber.on('message', (chan, message) => {
      if (chan === channel) {
        handler(JSON.parse(message));
      }
    });
  }

  publish(boardId: string, message: BoardMessage): void {
    this.publisher.publish(`board:${boardId}`, JSON.stringify(message));
  }
}
```

```ts
// src/crdt/yjsAdapter.ts
import * as Y from 'yjs';

export class YjsWhiteboard {
  private doc = new Y.Doc();
  private strokes = this.doc.getArray<Y.Map<unknown>>('strokes');
  private stateVector = new Uint8Array();

  constructor() {
    this.doc.on('update', (update: Uint8Array) => {
      this.stateVector = Y.encodeStateAsUpdate(this.doc);
    });
  }

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

  getStateVector(): Uint8Array {
    return this.stateVector;
  }

  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }
}
```

CRDTs (Conflict-free Replicated Data Types) are mathematically guaranteed to converge. Yjs implements them efficiently. Server A and Server B can apply updates independently and arrive at the same state.

## Pain #4: New Users Freeze on Join

A board has 50,000 strokes. A new user joins. You send all 50,000 strokes as one WebSocket message. It's 10MB. The browser freezes parsing JSON. The user leaves.

**Evolution: Full State → Delta Sync + Pagination**

```ts
// src/sync/deltaSync.ts
export class DeltaSync {
  async getSnapshot(boardId: string, lastSeq?: number): Promise<SyncPayload> {
    if (!lastSeq) {
      // First join: send compressed snapshot
      const snapshot = await this.getCompressedSnapshot(boardId);
      return {
        type: 'snapshot',
        data: snapshot,
        seq: await this.getCurrentSeq(boardId),
      };
    }

    // Reconnect: send only missed ops
    const ops = await prisma.stroke.findMany({
      where: {
        boardId,
        seq: { gt: lastSeq },
        deletedAt: null,
      },
      orderBy: { seq: 'asc' },
      take: 1000,
    });

    return {
      type: 'delta',
      ops,
      seq: ops[ops.length - 1]?.seq || lastSeq,
    };
  }

  private async getCompressedSnapshot(boardId: string): Promise<Buffer> {
    const strokes = await prisma.stroke.findMany({
      where: { boardId, deletedAt: null },
      orderBy: { seq: 'asc' },
    });

    // Binary compression: protobuf or msgpack
    return encodeStrokes(strokes);
  }
}
```

New users get a compressed snapshot. Reconnecting users get only the ops they missed. No 10MB JSON frames.

## Pain #5: Architecture Spaghetti

Your WebSocket handler validates messages, applies CRDTs, persists strokes, broadcasts updates, manages sessions, and handles replays. It's 600 lines.

**Evolution: Monolith → Layered → Service-Based**

```
┌─────────────────┐
│  WebSocket API  │  ← Connection management, auth
├─────────────────┤
│ Whiteboard Svc  │  ← Orchestration, sync logic
├─────────────────┤
│  Stroke Repo    │  ← PostgreSQL (Prisma)
│  CRDT Engine    │  ← Yjs / OT
│  Pub/Sub        │  ← Redis
│  Session Replay │  ← Replay log storage
├─────────────────┤
│  PostgreSQL     │  ← Stroke persistence
│  Redis          │  ← Pub/sub, presence
└─────────────────┘
```

```ts
// src/services/whiteboardService.ts
export class WhiteboardService {
  constructor(
    private strokeRepo: IStrokeRepository,
    private crdtEngine: ICrdtEngine,
    private pubsub: IPubSub,
    private replayLog: IReplayLog,
  ) {}

  async applyStroke(boardId: string, stroke: Stroke, userId: string): Promise<void> {
    // 1. Validate
    validateStroke(stroke);

    // 2. Apply to CRDT
    const update = this.crdtEngine.addStroke(boardId, stroke);

    // 3. Persist
    await this.strokeRepo.create(stroke);

    // 4. Broadcast via pub/sub (multi-server)
    this.pubsub.publish(boardId, {
      type: 'stroke',
      update: Buffer.from(update).toString('base64'),
      userId,
    });

    // 5. Append to replay log
    await this.replayLog.append(boardId, {
      type: 'stroke',
      stroke,
      timestamp: Date.now(),
    });
  }

  async getSyncPayload(boardId: string, lastSeq?: number): Promise<SyncPayload> {
    return this.strokeRepo.getDelta(boardId, lastSeq);
  }
}
```

## Pain #6: No Session Replay

A design review meeting needs to show how the wireframe evolved. You have the final state. You don't have the history. You can't show the creative process.

**Evolution: No History → Immutable Replay Log**

```ts
// src/replay/replayLog.ts
export class RedisReplayLog {
  private redis = new Redis(process.env.REDIS_URL);

  async append(boardId: string, event: ReplayEvent): Promise<void> {
    const key = `replay:${boardId}`;
    await this.redis.xadd(key, '*', 'event', JSON.stringify(event));

    // Trim to last 100,000 events (configurable)
    await this.redis.xtrim(key, 'MAXLEN', 100000);
  }

  async getReplay(boardId: string, startMs?: number, endMs?: number): Promise<ReplayEvent[]> {
    const key = `replay:${boardId}`;
    const start = startMs ? startMs : '-';
    const end = endMs ? endMs : '+';

    const entries = await this.redis.xrange(key, start, end);
    return entries.map(([, fields]) => JSON.parse(fields[1]));
  }

  async reconstructState(boardId: string, upToTimestamp: number): Promise<WhiteboardState> {
    const events = await this.getReplay(boardId, undefined, upToTimestamp);
    const doc = new Y.Doc();

    for (const event of events) {
      if (event.type === 'stroke') {
        const yStroke = new Y.Map();
        Object.entries(event.stroke).forEach(([k, v]) => yStroke.set(k, v));
        doc.getArray('strokes').push([yStroke]);
      } else if (event.type === 'delete') {
        const strokes = doc.getArray('strokes');
        const idx = strokes.toArray().findIndex(s => s.get('id') === event.strokeId);
        if (idx >= 0) strokes.delete(idx, 1);
      }
    }

    return yjsToState(doc);
  }
}
```

The replay log is an append-only stream. You can reconstruct the board at any point in time. Design reviews can show the creative process frame by frame.

## Final Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Load Balancer│────▶│  WS Server  │
│  (Browser)  │◄────│   (Sticky)    │◄────│   (Node)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ Whiteboard│                   │    CRDT        │                 │   Replay   │
        │  Service  │                   │   Engine       │                 │    Log     │
        └─────┬─────┘                   └───────┬────────┘                 └──────┬─────┘
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ PostgreSQL │                   │     Redis      │                 │   Redis    │
        │ (Strokes)  │                   │   (Pub/Sub)    │                 │  (Stream)  │
        └────────────┘                   └────────────────┘                 └────────────┘
```

## Production Checklist

- [ ] PostgreSQL with Prisma for stroke persistence
- [ ] Redis Pub/Sub for multi-server broadcast
- [ ] CRDT engine (Yjs) for conflict-free concurrent edits
- [ ] Delta sync for efficient reconnection
- [ ] Compressed snapshots for new users
- [ ] Immutable replay log (Redis Stream)
- [ ] Session replay with frame-by-frame reconstruction
- [ ] Layered architecture (WS → service → repos)
- [ ] Connection pooling (PgBouncer)
- [ ] Redis Sentinel for HA
- [ ] Binary protocol (protobuf/msgpack) for sync payloads

This is a production collaborative whiteboard. It started as a broadcast loop. Now it uses CRDTs for conflict resolution, Redis for multi-server sync, and immutable replay logs for session reconstruction.
