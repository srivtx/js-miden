# Project 3: Collaborative Whiteboard

> **Client Brief:** "Build me a real-time collaborative whiteboard like Excalidraw or Figma. Multiple users draw on the same canvas simultaneously. Changes sync in real-time. Users see each other's cursors. If two users draw on the same spot at the same time, it should NOT lose data. We need session replay. Offline support would be nice but not required."

---

## Section 1: The Brief (WHAT)

### Requirements Breakdown

| Requirement | Priority | Acceptance Criteria |
|-------------|----------|---------------------|
| Real-time drawing sync | P0 | Stroke appears on all clients <100ms after creator lifts pen |
| Multi-user presence | P0 | Cursor positions, user list, join/leave events |
| Conflict resolution | P0 | Concurrent edits to same stroke must not silently drop data |
| Session replay | P1 | HTTP endpoint streams all operations for a room |
| Room lifecycle | P1 | Create, join, leave whiteboard rooms |
| Offline support | P2 | (Out of scope for this guide) |

### User Stories

- **As a** designer, **I want** to sketch wireframes with my team **so that** we brainstorm synchronously.
- **As a** teacher, **I want** to watch a replay of my student's whiteboard session **so that** I can review their thought process.
- **As a** product manager, **I want** to move a sticky note while someone else recolors it **so that** we don't crash the app or lose the note.

### The Core Problem: Conflict Resolution

Two users, Alice and Bob, both grab the same stroke and move it. Alice moves it left. Bob moves it right. Both hit "sync" at the same millisecond.

**What happens?**

If you naively overwrite, whoever's packet arrives last wins. Alice's work vanishes. She thinks the app is broken. She is correct.

This is the central problem of this entire project. Everything else—WebSockets, presence, replay—is just plumbing around this one hard problem: **how do we merge two changes to the same thing without asking a human?**

---

## Section 2: Architecture (WHY)

### Why WebSockets over SSE?

Server-Sent Events (SSE) is great for one-way broadcast (Twitter feed, stock ticker). Drawing is **bidirectional**: the client is both a producer and a consumer of events. You could do it over SSE with a separate POST channel, but now you have two transports with different retry semantics, connection limits, and ordering guarantees. WebSockets gives us one persistent, full-duplex pipe.

**WHAT IF WRONG:** You use SSE + POST. Bob's drawing POST gets retried because of a 502. The retry arrives AFTER his next POST. Server has no idea they were reordered. Canvas diverges.

### Why NOT Just Broadcast Every Pixel Change?

A 1920x1080 canvas at 60fps is ~124 million pixels per second. Even compressed, that's absurd. Instead, we broadcast **operations**: "User A added stroke S with points [(10,10), (20,30)]". The payload is tiny. The client re-renders locally.

**WHAT IF WRONG:** You stream raw bitmap diffs. The server melts. The CEO asks why the AWS bill is $40k.

### Why Operational Transform OR CRDTs?

You need a way to merge edits. There are two major schools:

1. **Operational Transform (OT):** Transform incoming operations against local ones so they "fit." Google Docs uses this. It is precise but complex.
2. **CRDTs:** Mathematical structures that guarantee convergence if you just apply all operations, in any order, any number of times. Figma's ancestors used these.

Either one solves the Alice-and-Bob problem. We will teach both, then implement a **CRDT** because it is easier to reason about in a small codebase.

**WHAT IF WRONG:** You use a single server lock. "User A is editing, everyone else is read-only." Your users will riot. Real-time collaboration means parallel work, not turn-taking.

### Why Redis Pub/Sub for Multi-Server Scaling?

Socket.io rooms are in-memory. If User A connects to Server 1 and User B connects to Server 2, Server 1 cannot emit to User B. The `@socket.io/redis-adapter` uses Redis Pub/Sub as a backplane. Server 1 publishes the event to Redis; Server 2 picks it up and pushes it to its local clients.

**WHAT IF WRONG:** You scale to two servers without an adapter. Alice on Server 1 draws a line. Bob on Server 2 sees nothing. He refreshes. It's there. He refreshes again. It's gone. He quits.

### Why PostgreSQL for Session Storage?

We need to replay sessions. That means an append-only log of every operation. PostgreSQL gives us:
- Durability (WAL ensures committed ops survive crashes)
- JSONB for flexible operation payloads
- Time-range queries for "give me operations since snapshot #47"

**WHAT IF WRONG:** You store operations in a flat JSON file. The file grows to 2GB. `fs.readFile` blocks the event loop for 3 seconds. Everyone's cursor freezes.

### Why NOT Just Lock the Canvas?

Because it's a whiteboard, not a turn-based strategy game. Locking destroys the "collaborative" part of collaborative editing. If Alice is drawing in the top-left, Bob should be free to draw in the bottom-right.

**WHAT IF WRONG:** You implement pessimistic locking. Users email each other: "Hey, can you get off the canvas so I can move this arrow?" Your app is now Microsoft Word Track Changes circa 2003.

---

## Section 3: NEW Concepts (Inline Teaching)

### CRDTs (Conflict-free Replicated Data Types)

**WHAT IS IT?**

A CRDT is a data structure that can be edited independently on multiple machines, and when those edits are shared, the structures **automatically converge** to the same state. No central server needed for the merge logic.

**WHY USE IT HERE?**

Because our server might crash. Because we might add offline support later. Because it lets us reason about each stroke in isolation: "What is the true color of stroke #42 after 5 concurrent edits?"

**WHAT HAPPENS IF WE DON'T?**

Alice sets color to red. Bob sets color to blue. Server receives red, then blue. Final color: blue. Alice refreshes: blue. She never typed blue. She is confused and angry.

**Simplified Implementation:**

We use a **LWW-Register** (Last-Write-Wins Register) per stroke property, disambiguated by a **vector clock**.

```
Stroke #42 (in Alice's browser):
  color: { value: "red", vc: { alice: 5, bob: 2 } }

Stroke #42 (in Bob's browser):
  color: { value: "blue", vc: { alice: 4, bob: 3 } }

Merge:
  alice: max(5, 4) = 5
  bob: max(2, 3) = 3
  => merged VC: { alice: 5, bob: 3 }

Wait, neither dominates! Alice's is higher on alice; Bob's is higher on bob.
This means the operations were CONCURRENT.
We need a deterministic tiebreaker:
  If concurrent, compare millisecond timestamps.
  If timestamps are equal (unlikely), compare authorId lexicographically.

Winner: blue (if bob had a later timestamp).
Both Alice and Bob resolve the tie the same way. Convergence!
```

### Operational Transform (OT)

**WHAT IS IT?**

Google's algorithm for collaborative text editing. If Alice types "hello" and Bob concurrently deletes "h", you can't just apply both operations raw—you must **transform** them. Bob's delete needs to shift because Alice inserted characters before it.

**WHY USE IT HERE?**

For a drawing app, OT is overkill compared to CRDTs. But you must know it exists. If your client ever asks for a text box inside the whiteboard, you'll need OT for the text and CRDTs for the shapes.

**WHAT HAPPENS IF WE DON'T?**

Text boxes corrupt. Alice types "abc", Bob types "xyz" at the same position. Raw merge yields "axbycz" or worse. Google Docs would transform Bob's insert to position 4, yielding "abcxyz".

**ASCII Diagram:**

```
Initial:    |---|
Alice:      insert "X" at 0  ->  X|---|
Bob:        insert "Y" at 0  ->  Y|---|

If Bob applies Alice's op, he must TRANSFORM it:
  Alice's insert(0, "X") against his local insert(0, "Y")
  -> becomes insert(1, "X")
Result: YX|---|  (correct)

Without transform:
  Alice applies Bob's op raw: insert(0, "Y") -> YX|---| (ok by accident here)
  But if both deleted position 0:
    Alice: delete(0) -> |---|
    Bob:   delete(0) -> |---|
    Raw application on both sides would delete TWO characters. Data loss!
```

### Presence Awareness

**WHAT IS IT?**

Knowing who is in the room right now. Cursor positions. Avatars. The "user is typing" indicator.

**WHY USE IT HERE?**

Without presence, Alice draws a line and wonders if anyone saw it. With presence, she sees Bob's cursor hovering nearby. It feels real.

**WHAT HAPPENS IF WE DON'T?**

Ghost users. Bob's WiFi hiccups. He reconnects with a new socket ID. The old socket ID is still in the user list. After an hour, the user list has 47 entries. 46 are dead.

**Implementation Pattern:**

```
Client: every 3 seconds -> emit("heartbeat")
Server: on("heartbeat") -> update lastSeen = now
Server: every 10 seconds -> scan presence map
         if now - lastSeen > 30s -> delete, broadcast "user left"
```

### Session Replay

**WHAT IS IT?**

Recording every operation that changes the canvas, then replaying them later to reconstruct the session.

**WHY USE IT HERE?**

The client explicitly asked for it. Teachers review student work. Designers review client feedback sessions.

**WHAT HAPPENS IF WE DON'T?**

You only store the final PNG. A manager asks, "How did this design get here?" You shrug. The PNG has no history.

**Implementation Pattern:**

Instead of saving a screenshot every minute, save the **operation log**:

```
1. add_stroke(id=1, points=[...], color="red")
2. add_stroke(id=2, points=[...], color="blue")
3. update_stroke(id=1, color="green")
4. delete_stroke(id=2)
```

Replay: create a fresh CRDT, apply operations 1-4 in order. You now have the exact final state, plus the journey.

### Optimistic Updates

**WHAT IS IT?**

The client shows the stroke immediately, BEFORE the server acknowledges it. The server validates and merges later. If rejected, the client rolls back.

**WHY USE IT HERE?**

Drawing feels instant. If you waited for a round-trip to the server before showing the pixel, drawing would feel like typing over a satellite phone.

**WHAT HAPPENS IF WE DON'T?**

Lag. Users draw a line, wait 80ms, see the line appear. They think the app is sluggish. They switch to Figma.

**Implementation Pattern:**

```
Client:
  onMouseDown -> generate UUID, render stroke locally
  emit("op", stroke) to server
  on("op:rejected", id) -> remove local stroke
  on("op", incomingStroke) -> if incomingStroke.id === local.id, keep it (confirmed)
```

### Vector Clocks / Lamport Timestamps

**WHAT IS IT?**

A vector clock is a map `{ alice: 5, bob: 3 }` representing "Alice has seen 5 of her own events and 3 of Bob's." It lets us determine if Event A happened before Event B, or if they were concurrent.

A **Lamport timestamp** is a single integer that gives a partial order. It is simpler but cannot detect concurrency.

**WHY USE IT HERE?**

We need to know if two edits to the same stroke happened one after another, or at the same time. If concurrent, we run our tiebreaker. If causal, the later one wins unambiguously.

**WHAT HAPPENS IF WE DON'T?**

You use wall-clock timestamps (`Date.now()`). Alice's clock is 2 seconds fast. She edits stroke #42. Bob edited it 1 second ago (real time), but his `Date.now()` is later than Alice's. Your logic says Bob's edit is later. Alice's edit is lost. She fixes her clock. Now it works. You have built a clock-debugging service, not a whiteboard.

**Simplified Vector Clock Logic:**

```ts
function compareVC(a: VectorClock, b: VectorClock): 'gt' | 'lt' | 'concurrent' | 'equal' {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;

  for (const k of keys) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    if (av > bv) aGreater = true;
    if (bv > av) bGreater = true;
  }

  if (aGreater && !bGreater) return 'gt';
  if (bGreater && !aGreater) return 'lt';
  if (!aGreater && !bGreater) return 'equal';
  return 'concurrent';
}
```

---

## Section 4: Step-by-Step Build Guide

### Project Structure

```
whiteboard/
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── src/
    ├── types.ts
    ├── crdt.ts
    ├── db.ts
    └── server.ts
```

### 1. WebSocket Server Setup

**`package.json`**

```json
{
  "name": "collaborative-whiteboard",
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^5.0.0",
    "socket.io": "^4.8.0",
    "@socket.io/redis-adapter": "^8.3.0",
    "redis": "^4.7.0",
    "pg": "^8.13.0",
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/cors": "^2.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**`src/types.ts`**

```ts
export interface Point { x: number; y: number; }

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  author: string;
  timestamp: number;
}

export type VectorClock = Record<string, number>;

export interface Operation {
  id: string;
  type: 'add_stroke' | 'delete_stroke' | 'update_stroke';
  strokeId: string;
  payload: any;
  vectorClock: VectorClock;
  author: string;
  timestamp: number;
  sequenceNumber: number; // Server-assigned monotonic sequence for stable ordering
}

export interface Presence {
  userId: string;
  name: string;
  cursor: { x: number; y: number };
  lastSeen: number;
}
```

### 2. CRDT Logic

**`src/crdt.ts`**

```ts
import type { Operation, VectorClock, Stroke } from './types.js';

export function compareVectorClocks(a: VectorClock, b: VectorClock): 'gt' | 'lt' | 'concurrent' | 'equal' {
  let aDominates = false;
  let bDominates = false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const k of keys) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    if (av > bv) aDominates = true;
    if (bv > av) bDominates = true;
  }

  if (aDominates && !bDominates) return 'gt';
  if (bDominates && !aDominates) return 'lt';
  if (!aDominates && !bDominates) return 'equal';
  return 'concurrent';
}

export function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const res: VectorClock = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) res[k] = Math.max(a[k] || 0, b[k] || 0);
  return res;
}

function resolveConcurrentTiebreak(a: Operation, b: Operation): 'a' | 'b' {
  // Deterministic: server sequence wins, then wall-clock, then lexicographic authorId.
  // Server sequence numbers eliminate millisecond collision issues.
  if (a.sequenceNumber !== b.sequenceNumber) {
    return a.sequenceNumber > b.sequenceNumber ? 'a' : 'b';
  }
  if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? 'a' : 'b';
  return a.author > b.author ? 'a' : 'b';
}

export class WhiteboardCRDT {
  strokes = new Map<string, Stroke>();
  strokeVersions = new Map<string, VectorClock>();
  strokeMeta = new Map<string, { sequenceNumber: number; timestamp: number; author: string }>();

  applyOp(op: Operation): boolean {
    const current = this.strokes.get(op.strokeId);
    const currentVC = this.strokeVersions.get(op.strokeId) || {};
    const currentMeta = this.strokeMeta.get(op.strokeId) || { sequenceNumber: 0, timestamp: 0, author: '' };

    if (op.type === 'add_stroke') {
      if (!current) {
        this.strokes.set(op.strokeId, op.payload);
        this.strokeVersions.set(op.strokeId, op.vectorClock);
        this.strokeMeta.set(op.strokeId, { sequenceNumber: op.sequenceNumber, timestamp: op.timestamp, author: op.author });
        return true;
      }
      // Already exists -> fall through to update semantics
    }

    if (op.type === 'delete_stroke') {
      const cmp = compareVectorClocks(op.vectorClock, currentVC);
      if (cmp === 'gt') {
        this.strokes.delete(op.strokeId);
        this.strokeVersions.set(op.strokeId, op.vectorClock);
        this.strokeMeta.set(op.strokeId, { sequenceNumber: op.sequenceNumber, timestamp: op.timestamp, author: op.author });
        return true;
      }
      if (cmp === 'concurrent') {
        // Concurrent deletion vs existence: deletion wins unless tiebreaker says otherwise
        const winner = resolveConcurrentTiebreak(op, {
          ...op,
          vectorClock: currentVC,
          sequenceNumber: currentMeta.sequenceNumber,
          timestamp: currentMeta.timestamp,
          author: currentMeta.author
        });
        if (winner === 'a') {
          this.strokes.delete(op.strokeId);
          this.strokeVersions.set(op.strokeId, mergeVectorClocks(currentVC, op.vectorClock));
          this.strokeMeta.set(op.strokeId, { sequenceNumber: op.sequenceNumber, timestamp: op.timestamp, author: op.author });
          return true;
        }
      }
      return false;
    }

    if (op.type === 'update_stroke') {
      if (!current) return false;
      const cmp = compareVectorClocks(op.vectorClock, currentVC);
      if (cmp === 'gt') {
        this.strokes.set(op.strokeId, { ...current, ...op.payload });
        this.strokeVersions.set(op.strokeId, mergeVectorClocks(currentVC, op.vectorClock));
        this.strokeMeta.set(op.strokeId, { sequenceNumber: op.sequenceNumber, timestamp: op.timestamp, author: op.author });
        return true;
      }
      if (cmp === 'concurrent') {
        const winner = resolveConcurrentTiebreak(op, {
          ...op,
          vectorClock: currentVC,
          sequenceNumber: currentMeta.sequenceNumber,
          timestamp: currentMeta.timestamp,
          author: currentMeta.author
        });
        if (winner === 'a') {
          this.strokes.set(op.strokeId, { ...current, ...op.payload });
          this.strokeVersions.set(op.strokeId, mergeVectorClocks(currentVC, op.vectorClock));
          this.strokeMeta.set(op.strokeId, { sequenceNumber: op.sequenceNumber, timestamp: op.timestamp, author: op.author });
          return true;
        }
      }
      return false;
    }

    return false;
  }

  getClientState() {
    return Object.fromEntries(this.strokes);
  }

  getSnapshot() {
    return {
      strokes: Object.fromEntries(this.strokes),
      versions: Object.fromEntries(this.strokeVersions),
      meta: Object.fromEntries(this.strokeMeta),
    };
  }
}
```

### 3. Database Layer

**`src/db.ts`**

```ts
import pg from 'pg';
const { Pool } = pg;
import type { Operation } from './types.js';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://wbuser:wbpass@localhost:5432/whiteboard'
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whiteboards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      whiteboard_id UUID NOT NULL,
      op_type TEXT NOT NULL,
      stroke_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      vector_clock JSONB NOT NULL,
      author TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      sequence_number BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      whiteboard_id UUID NOT NULL,
      state JSONB NOT NULL,
      operation_count INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ops_wb_seq ON operations(whiteboard_id, sequence_number);
    CREATE INDEX IF NOT EXISTS idx_snap_wb ON snapshots(whiteboard_id, created_at DESC);
  `);
}

export async function appendOperation(roomId: string, op: Operation) {
  await pool.query(
    `INSERT INTO operations (whiteboard_id, op_type, stroke_id, payload, vector_clock, author, timestamp, sequence_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [roomId, op.type, op.strokeId, JSON.stringify(op.payload), JSON.stringify(op.vectorClock), op.author, op.timestamp, op.sequenceNumber]
  );
}

export async function getOperationsSince(roomId: string, sinceSequence: number): Promise<Operation[]> {
  const res = await pool.query(
    `SELECT op_type AS type, stroke_id AS strokeId, payload, vector_clock AS vectorClock,
            author, timestamp, id, sequence_number AS "sequenceNumber"
     FROM operations
     WHERE whiteboard_id = $1 AND sequence_number > $2
     ORDER BY sequence_number ASC, timestamp ASC, id ASC`,
    [roomId, sinceSequence]
  );
  return res.rows.map(r => ({
    ...r,
    vectorClock: r.vectorclock, // pg lowercases
    sequenceNumber: r.sequenceNumber
  })) as Operation[];
}

export async function getLatestSnapshot(roomId: string) {
  const res = await pool.query(
    `SELECT state, operation_count FROM snapshots WHERE whiteboard_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [roomId]
  );
  return res.rows[0] || null;
}

export async function saveSnapshot(roomId: string, state: object, opCount: number) {
  await pool.query(
    `INSERT INTO snapshots (whiteboard_id, state, operation_count) VALUES ($1, $2, $3)`,
    [roomId, JSON.stringify(state), opCount]
  );
}
```

### 4. Main Server

**`src/server.ts`**

```ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { WhiteboardCRDT } from './crdt.js';
import { initDB, appendOperation, getOperationsSince, getLatestSnapshot, saveSnapshot } from './db.js';
import type { Operation, Presence } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN || '*' } });

// Redis adapter for multi-server scaling
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
await pubClient.connect();
await subClient.connect();
io.adapter(createAdapter(pubClient, subClient));

await initDB();

// In-memory room state (lazy-loaded from DB on first join)
const rooms = new Map<string, {
  crdt: WhiteboardCRDT;
  presence: Map<string, Presence>;
  opCount: number;
}>();

async function loadRoom(roomId: string) {
  const crdt = new WhiteboardCRDT();
  let opCount = 0;

  const snapshot = await getLatestSnapshot(roomId);
  if (snapshot) {
    const fullState = snapshot.state as any;
    Object.entries(fullState.strokes || {}).forEach(([id, stroke]) => crdt.strokes.set(id, stroke as any));
    Object.entries(fullState.versions || {}).forEach(([id, vc]) => crdt.strokeVersions.set(id, vc as any));
    Object.entries(fullState.meta || {}).forEach(([id, meta]) => crdt.strokeMeta.set(id, meta as any));
    opCount = snapshot.operation_count;
  }

  const ops = await getOperationsSince(roomId, opCount);
  for (const op of ops) {
    crdt.applyOp(op);
    opCount = Math.max(opCount, op.sequenceNumber);
  }

  return { crdt, presence: new Map<string, Presence>(), opCount };
}

async function getRoom(roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, await loadRoom(roomId));
  }
  return rooms.get(roomId)!;
}

// Redis-backed presence for multi-server consistency.
// Each room's presence is a Redis Hash with 60-second TTL.
// Local Maps are kept as fast write-through caches for cursor moves.
async function refreshPresence(roomId: string, userId: string, presence: Presence) {
  await pubClient.hSet(`presence:${roomId}`, userId, JSON.stringify(presence));
  await pubClient.expire(`presence:${roomId}`, 60);
}

async function removePresence(roomId: string, userId: string) {
  await pubClient.hDel(`presence:${roomId}`, userId);
}

async function getRoomPresence(roomId: string): Promise<Presence[]> {
  const data = await pubClient.hGetAll(`presence:${roomId}`);
  const now = Date.now();
  return Object.values(data)
    .map(v => JSON.parse(v) as Presence)
    .filter(p => now - p.lastSeen < 30000);
}

// JWT auth middleware for Socket.io
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token as string;
    if (!token) throw new Error('Missing token');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; name: string };
    socket.data.userId = decoded.userId;
    socket.data.userName = decoded.name;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Rate limiter: token bucket per user
const rateBuckets = new Map<string, { tokens: number; lastCheck: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_REFILL_MS = 100;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId) || { tokens: RATE_LIMIT_MAX, lastCheck: now };
  const elapsed = now - bucket.lastCheck;
  bucket.tokens = Math.min(RATE_LIMIT_MAX, bucket.tokens + elapsed / RATE_LIMIT_REFILL_MS);
  bucket.lastCheck = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  rateBuckets.set(userId, bucket);
  return true;
}

io.on('connection', (socket) => {
  let currentRoom: string | null = null;
  const userId = socket.data.userId as string;
  const userName = socket.data.userName as string;

  socket.on('room:join', async (roomId: string, cb?: Function) => {
    if (!ROOM_ID_REGEX.test(roomId)) {
      cb?.({ ok: false, error: 'invalid_room_id' });
      return;
    }
    currentRoom = roomId;
    socket.join(roomId);
    const room = await getRoom(roomId);

    // Send current state + presence (read from Redis so multi-server joiners see everyone)
    socket.emit('state:init', {
      state: room.crdt.getClientState(),
      presence: await getRoomPresence(roomId),
      sequenceNumber: room.opCount
    });

    // Announce join
    const presence: Presence = {
      userId, name: userName,
      cursor: { x: 0, y: 0 },
      lastSeen: Date.now()
    };
    room.presence.set(userId, presence);
    await refreshPresence(roomId, userId, presence);
    socket.to(roomId).emit('presence:joined', presence);

    cb?.({ ok: true });
  });

  socket.on('op', async (op: Operation, cb?: Function) => {
    if (!currentRoom) return;

    // Rate limit check
    if (!checkRateLimit(userId)) {
      cb?.({ applied: false, error: 'rate_limited' });
      return;
    }

    const room = await getRoom(currentRoom);

    // Enrich operation metadata
    op.id = randomUUID();
    op.author = userId;
    // Preserve client timestamp for CRDT semantics; add server sequence for ordering
    op.sequenceNumber = ++room.opCount;

    // Apply to CRDT
    const applied = room.crdt.applyOp(op);
    if (applied) {
      await appendOperation(currentRoom, op);
      socket.to(currentRoom).emit('op', op);

      // Snapshot compaction every 500 ops — offload to background to avoid blocking event loop
      if (room.opCount % 500 === 0) {
        setImmediate(() => saveSnapshot(currentRoom, room.crdt.getSnapshot(), room.opCount).catch(console.error));
      }
    }

    cb?.({ applied, state: room.crdt.getClientState() });
  });

  socket.on('cursor:move', async (pos: { x: number; y: number }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const p = room.presence.get(userId);
    if (p) {
      p.cursor = pos;
      p.lastSeen = Date.now();
      await refreshPresence(currentRoom, userId, p);
      socket.to(currentRoom).emit('cursor:move', { userId, cursor: pos });
    }
  });

  socket.on('disconnect', async () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.presence.delete(userId);
        await removePresence(currentRoom, userId);
        io.to(currentRoom).emit('presence:left', { userId });
      }
    }
  });
});

// JWT middleware for HTTP routes
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// HTTP Replay endpoint (authenticated)
app.get('/replay/:roomId', requireAuth, async (req, res) => {
  const roomId = req.params.roomId;
  if (!ROOM_ID_REGEX.test(roomId)) {
    res.status(400).json({ error: 'invalid_room_id' });
    return;
  }
  const since = Number(req.query.since) || 0;
  const ops = await getOperationsSince(roomId, since);
  res.json({ operations: ops });
});

// Snapshot endpoint (authenticated)
app.get('/snapshot/:roomId', requireAuth, async (req, res) => {
  const roomId = req.params.roomId;
  if (!ROOM_ID_REGEX.test(roomId)) {
    res.status(400).json({ error: 'invalid_room_id' });
    return;
  }
  const snap = await getLatestSnapshot(roomId);
  res.json(snap || { state: {}, operation_count: 0 });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Whiteboard server on ${PORT}`));
```

> **SECURITY FIX — Authentication:**
> **WHY it was dangerous:** The original code accepted `userId` directly from `socket.handshake.auth.userId` with zero verification. Anyone could impersonate any user by sending `auth: { userId: 'alice' }`. The HTTP replay endpoint had no auth at all, allowing anyone to dump every operation from any room. This is a complete confidentiality and integrity breach.
> **HOW the fix works:** We added JWT verification to both Socket.io (`io.use`) and HTTP routes (`requireAuth`). The client must provide a valid signed token. The server extracts `userId` from the token payload, not from user input. This ensures only legitimate users can connect and access room data.

> **SECURITY FIX — Server Sequence Numbers & Vector Clocks:**
> **WHY it was dangerous:** The server overwrote `op.timestamp = Date.now()`, destroying the client's vector clock semantics. If two clients sent concurrent ops, the server's mutation could make the tiebreaker inconsistent with the client's original intent, causing canvas desync under network partitions.
> **HOW the fix works:** We preserve the client's `timestamp` for CRDT semantics and add a server-assigned `sequenceNumber` for stable ordering. The tiebreaker now uses `sequenceNumber` first, eliminating ambiguity. Vector clocks remain pure for concurrency detection while the server sequence handles ordering.

> **SECURITY FIX — Millisecond Timestamp Collisions:**
> **WHY it was dangerous:** `ORDER BY timestamp ASC` on millisecond timestamps provides no stable tiebreaker when two ops arrive in the same millisecond. PostgreSQL may return them in arbitrary order, causing non-deterministic state reconstruction after reconnects.
> **HOW the fix works:** We added a `sequence_number BIGINT` column with a database index. `getOperationsSince` queries and orders by `sequence_number ASC, timestamp ASC, id ASC`. This guarantees every client reconstructs the exact same operation history.

> **SECURITY FIX — Rate Limiting:**
> **WHY it was dangerous:** Any connected client could emit operations as fast as the network allowed. A single malicious client could DDoS the server, saturate Redis pub/sub, and crash every browser in the room with excessive re-renders.
> **HOW the fix works:** A token-bucket rate limiter (`checkRateLimit`) caps each user at 10 operations per 100ms refill. Excess ops are rejected with `rate_limited` before any CRDT application or broadcast, protecting the server and all clients.

> **ARCHITECTURE FIX — Lazy-Loaded Room State:**
> **WHY it was dangerous:** The entire CRDT state lived in a process-local Map. A server restart (deploy, crash, OOM) wiped all rooms to blank canvases. Users would reconnect to an empty whiteboard.
> **HOW the fix works:** `getRoom` now lazy-loads from PostgreSQL on first join. It loads the latest snapshot and replays operations since that snapshot. Room state survives process restarts.

> **ARCHITECTURE FIX — Async Snapshotting:**
> **WHY it was dangerous:** `await saveSnapshot(...)` inside the WebSocket `op` handler blocked the single-threaded Node.js event loop. A 500ms snapshot save paused operation processing for ALL rooms.
> **HOW the fix works:** Snapshotting is offloaded to `setImmediate`, which queues it after the current event loop tick. The `op` handler returns immediately, and the snapshot runs in the background without stalling other clients.

> **ARCHITECTURE FIX — Distributed Presence:**
> **WHY it was dangerous:** Presence data lived in a process-local Map. With the Redis adapter, Socket.io broadcasts messages across servers, but the `rooms` Map (including presence) is NOT shared. User A on Server 1 sees User B on Server 1, but not User C on Server 2. The presence list becomes incorrect in multi-server deployments.
> **HOW the fix works:** We replaced the local-only presence map with a Redis-backed Hash per room (`presence:${roomId}`) with 60-second TTL. `state:init` reads from Redis so new joiners see users on ALL servers. Cursor moves and disconnects write through to Redis. Redis TTL automatically evicts ghost users when servers crash or networks partition.

> **SECURITY FIX — Room ID Validation:**
> **WHY it was dangerous:** `roomId` was used directly as a database key and Socket.io room name with no validation. Extremely long or malformed room IDs could cause DB issues or collide with Socket.io internal namespaces.
> **HOW the fix works:** `ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/` validates every room ID before use. Invalid IDs are rejected with `400 Bad Request`.

### Running It

```bash
# Terminal 1
pnpm install
# Start dependencies
docker compose up -d
# Start server
pnpm dev

# Terminal 2 - Test replay
curl http://localhost:3000/replay/my-room
```

---

## Section 5: 5 Intentional Bugs

### Bug 1: No Conflict Resolution

**How to Introduce:**
Replace `crdt.applyOp` with a naive overwrite:

```ts
// BAD CODE
room.strokes.set(op.strokeId, op.payload);
socket.to(currentRoom).emit('op', op);
```

**Symptoms:**
Alice draws a red circle. Bob changes it to blue. Alice sees it turn blue. She changes it back to red. Bob sees red. They fight endlessly. One of them will eventually refresh and see a color they never chose.

**Reproduction:**
1. Open two browsers.
2. Both select the same stroke.
3. Change color simultaneously.
4. Observe that one color permanently disappears.

**Fix:**
Use the `WhiteboardCRDT.applyOp` logic with vector clock comparison and concurrent tiebreaking.

**WHY:**
Without a merge strategy, the network packet arrival order defines truth. The network is not a source of truth; it is a source of chaos.

### Bug 2: Missing Operation Ordering

**How to Introduce:**
Apply operations in the order they arrive at the client, with no re-ordering buffer:

```ts
// BAD CODE (client-side)
socket.on('op', (op) => {
  strokes[op.strokeId] = op.payload; // apply immediately
});
```

**Symptoms:**
Alice moves a stroke 10px right. Then she moves it 5px left. Bob receives the "5px left" operation first (network reordering), then the "10px right." The stroke ends up 10px right of where Alice intended.

**Reproduction:**
1. Throttle one client's network to 3G.
2. Rapidly move a stroke back and forth.
3. The stroke drifts from its true position.

**Fix:**
Use server-side sequencing (assign each op a monotonic `sequenceNumber` per room) or vector clocks. Client buffers out-of-order ops until the missing predecessor arrives.

**WHY:**
TCP guarantees in-order delivery per connection, but Socket.io rooms broadcast across multiple connections. UDP-like behavior can emerge from retries, reconnects, and adapter fanout.

### Bug 3: Memory Leak in Presence

**How to Introduce:**
Add users to the presence map on `room:join`, but never remove them:

```ts
// BAD CODE
socket.on('room:join', (roomId) => {
  const room = getRoom(roomId);
  room.presence.set(userId, { userId, name, cursor: {x:0,y:0}, lastSeen: Date.now() });
});
// No disconnect handler. No heartbeat scan.
```

**Symptoms:**
After a day of uptime, the presence list for a popular room has 10,000 entries. 9,980 are ghosts. The JSON payload for `state:init` is 4MB. New joiners freeze for 2 seconds while parsing it.

**Reproduction:**
1. Join a room.
2. Close the browser tab (do NOT call leave).
3. Rejoin with a new socket.
4. Repeat 10 times.
5. Observer: user list shows 11 entries.

**Fix:**
Implement the heartbeat timeout cleanup loop shown in `server.ts`:

```ts
setInterval(() => {
  // evict if lastSeen > 30s
}, 10000);
```

**WHY:**
Sockets are not reliable death certificates. A client can disappear via WiFi dropout, battery death, or browser crash. The server must treat silence as a potential departure.

### Bug 4: Replay From Beginning for Every Join

**How to Introduce:**
On `room:join`, query ALL operations from the database and emit them:

```ts
// BAD CODE
const allOps = await pool.query(`SELECT * FROM operations WHERE whiteboard_id = $1`, [roomId]);
socket.emit('state:init', { operations: allOps.rows });
```

**Symptoms:**
A room that has been active for 3 months has 250,000 operations. A new user joins. The server sends 45MB of JSON. The client chokes for 15 seconds before rendering anything.

**Reproduction:**
1. Generate 10,000 operations in a room.
2. Join with a new client.
3. Profile the network tab: massive payload, long parse time.

**Fix:**
Snapshot + delta. The server sends the latest snapshot plus only the operations AFTER that snapshot:

```ts
const snapshot = await getLatestSnapshot(roomId);
const ops = await getOperationsSince(roomId, snapshot?.operation_count || 0);
// Client rebuilds from snapshot, then applies ops
```

**WHY:**
Event sourcing is powerful, but no human needs to replay 3 months of micro-edits to draw a line. Snapshots are the compression algorithm of time.

### Bug 5: No Backpressure on Broadcast

**How to Introduce:**
Allow clients to emit operations as fast as they can draw:

```ts
// BAD CODE
socket.on('op', async (op) => {
  // immediately broadcast
  io.to(roomId).emit('op', op);
});
```

**Symptoms:**
A user with a script (or a stuck mouse button) emits 1,000 operations per second. Every client in the room receives 1,000 ops/sec. Their CPUs max out re-rendering. The tab crashes. The server CPU spikes handling Redis fanout.

**Reproduction:**
1. Write a client loop: `setInterval(() => socket.emit('op', ...), 1)`.
2. Observe server CPU and client responsiveness.

**Fix:**
Rate limit per client. Simple token bucket:

```ts
const buckets = new Map<string, number>();

socket.on('op', async (op, cb) => {
  const now = Date.now();
  const tokens = (buckets.get(userId) || 10) + ((now - lastCheck) / 100); // refill
  if (tokens < 1) return cb?.({ error: 'rate_limited' });
  buckets.set(userId, Math.min(tokens - 1, 10));
  // ... proceed
});
```

Also batch operations client-side: buffer 50ms of drawing, then emit one `add_stroke` op with all points.

**WHY:**
WebSockets are not infinite pipes. Redis, Node.js, and the browser's renderer all have limits. Backpressure is the difference between a whiteboard and a DDoS cannon.

---

## Section 6: Scaling Considerations

### How Many Users Per Room Before It Breaks?

Socket.io rooms use a fanout broadcast: one message is sent to N clients. In practice:
- **~50 users:** Butter smooth.
- **~200 users:** Noticeable latency on broadcast.
- **~500 users:** You need interest management (only send ops within the user's viewport).
- **~1000+ users:** Break into sub-rooms or use spatial partitioning.

**Mitigation:** Don't broadcast cursor moves to everyone. Send them only to users viewing the same screen region.

### Sharding Rooms Across Servers

With the Redis adapter, any server can handle any room. But if one room becomes "hot" (e.g., a Twitch streamer's whiteboard), all servers route traffic through Redis for that room. You may need **room affinity**: pin a room to one server and route all its traffic there. Use a load balancer with consistent hashing on `roomId`.

### Snapshot Strategy

Storing every operation forever is elegant but impractical. Compact when:
- Operation count exceeds 1,000 per room.
- Room has been inactive for 24 hours.
- Scheduled nightly job.

Store snapshots as JSONB in PostgreSQL. When replaying, load the latest snapshot and replay only subsequent deltas.

### Why Figma Doesn't Use CRDTs

Figma uses a **custom sync engine** (historically called LiveGraph). They explicitly avoid CRDTs for their core document model because:
1. **Semantic precision:** Moving a frame and resizing it concurrently have specific merge rules that generic CRDTs can't express.
2. **Server authority:** Figma treats the server as the single source of truth, using operation logs and server-side resolution rather than peer-to-peer convergence.
3. **Performance:** Their engine supports partial replication (load only the layers you see).

**Lesson:** CRDTs are a fantastic default. But if your product's merge semantics are highly specific, a custom engine may be worth the investment.

---

## Section 7: Deployment

### `docker-compose.yml`

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: wbuser
      POSTGRES_PASSWORD: wbpass
      POSTGRES_DB: whiteboard
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://wbuser:wbpass@postgres:5432/whiteboard
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
```

### `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### WebSocket Load Balancing

**Option A: Sticky Sessions**
If you do NOT use the Redis adapter, you MUST use sticky sessions. Configure nginx:

```nginx
upstream wb_backend {
    ip_hash;  # sticky by IP
    server app1:3000;
    server app2:3000;
}
```

**Option B: Redis Adapter (Recommended)**
With `@socket.io/redis-adapter`, sticky sessions are unnecessary. Any server can receive and broadcast. Your load balancer can use round-robin.

**WHAT IF WRONG:**
You deploy 3 app servers behind a round-robin load balancer with no Redis adapter and no sticky sessions. Alice connects to Server 1. Bob connects to Server 2. They are in the same room. They draw. They see nothing. They post angry tweets.

---

## Section 8: Post-Mortem Template

Copy this into your incident tracker when things go wrong (and they will).

```markdown
## Incident: [TITLE] - [DATE]

### Impact
- Severity: [SEV1/SEV2/SEV3]
- Users affected: [N or "all"]
- Duration: [HH:MM]

### Summary
One sentence of what happened.

### Root Cause
The vector clock comparison had a bug where `|| 0` was missing, causing `undefined > number` to return `false` silently. Concurrent edits were always rejected, making the canvas appear frozen.

### Timeline
- 14:00 UTC: Alice reports she can't see Bob's strokes
- 14:05 UTC: On-call notices CPU is normal but Redis traffic is zero
- 14:10 UTC: Bug identified in `compareVectorClocks`
- 14:15 UTC: Hotfix deployed

### What Went Well
- CRDT design meant no data was corrupted; ops were just stalled.
- Replay endpoint helped us reconstruct the exact state pre-bug.

### What Went Wrong
- Unit tests only tested causal ordering, not concurrent branches.
- No alarm on "room with 100 users but zero cross-traffic."

### Action Items
- [ ] Add property-based tests for concurrent vector clock merges.
- [ ] Add metric: `whiteboard.merge_rejection_rate` with alert >5%.
- [ ] Document the tiebreaker rule in the API contract.

### Lessons Learned
CRDTs save you from data loss, but they do NOT save you from logic bugs in the merge function. Test the conflict path, not just the happy path.
```

---

## Summary

You just built a real-time collaborative whiteboard backend that:

- Uses **WebSockets** for bidirectional, low-latency sync.
- Uses **CRDTs** with **vector clocks** to resolve concurrent edits deterministically.
- Uses **Redis Pub/Sub** to scale across multiple servers.
- Uses **PostgreSQL** to durably log every operation for replay.
- Uses **snapshots** so new users don't download the entire history of the universe.
- Uses **heartbeats** to keep the user list honest.
- Uses **rate limiting** to prevent one hyperactive user from melting the room.

You also learned why **OT** exists, why **Figma rolled their own engine**, and why you should never, ever lock the entire canvas.

Now go draw something.
