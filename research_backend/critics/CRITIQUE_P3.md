# Critique Report: Project 3 — Collaborative Whiteboard

**Reviewer:** Senior Technical Critic Agent  
**Date:** 2026-05-06  
**File Reviewed:** `/docs_js_backend/projects/03-collaborative-whiteboard/README.md`

---

## Executive Summary

This is the **most educationally sound** project of the four. The CRDT explanation is clear, the vector clock logic is mostly correct, and the bugs are well-designed for learning. However, it has **critical security gaps** (no auth, open replay endpoints), **architectural flaws** (in-memory room state lost on restart, synchronous snapshotting blocking the event loop), and **subtle CRDT bugs** that would cause data divergence in production.

---

## CRITICAL (Will cause incidents if copied)

### C1. Zero Authentication on WebSockets and HTTP Endpoints
- **Location:** `src/server.ts` (`socket.handshake.auth.userId`), `app.get('/replay/:roomId')`
- **Issue:** `userId` is taken directly from `socket.handshake.auth.userId` without any JWT verification, session token check, or OAuth flow. Anyone can connect as any user by setting `auth: { userId: 'alice' }`. The HTTP replay endpoint (`/replay/:roomId`) has NO authentication—anyone can dump every operation from any room.
- **Impact:** Complete lack of authorization. Attackers can impersonate users, spy on private whiteboards, and extract full session histories.
- **Fix Required:** Add JWT middleware for HTTP routes and Socket.io `io.use((socket, next) => { verifyJWT(socket.handshake.auth.token, next); })`.

### C2. Server-Assigned Timestamp Breaks Vector Clock Semantics
- **Location:** `src/server.ts` `socket.on('op', ...)`
- **Issue:** The client sends an operation with a `vectorClock` representing its local causal knowledge. The server then overwrites `op.timestamp = Date.now()` and `op.author = userId`. The CRDT tiebreaker uses `timestamp` and `author`, which are now server-assigned. But the `vectorClock` was computed client-side based on a different timestamp/author model. If two clients send concurrent ops, the server mutates them in ways that can make the vector clock comparison and tiebreaker inconsistent with the client's original intent.
- **Impact:** Subtle divergence bugs where two clients disagree on which concurrent operation won, causing canvas desync that only appears under network partitions.
- **Fix Required:** Either trust the client's timestamp (with bounds checking) or separate server sequencing from CRDT metadata. Better: use server-assigned sequence numbers for ordering and keep vector clocks purely for concurrency detection.

### C3. `timestamp` is Used as Both Wall Clock and Sequence Proxy
- **Location:** `src/db.ts` `getOperationsSince`, `src/crdt.ts`
- **Issue:** `getOperationsSince` queries `WHERE timestamp > $2`. `timestamp` is `Date.now()`, which is a wall-clock millisecond timestamp. Two operations created in the same millisecond will have identical timestamps. The `ORDER BY timestamp ASC` provides no stable tiebreaker, so PostgreSQL may return them in arbitrary order. If the client applies them in a different order than another client, the CRDTs diverge (despite CRDTs being order-independent for some operations, `update_stroke` with `gt` comparison IS order-dependent).
- **Impact:** Non-deterministic state reconstruction after reconnects or replays.
- **Fix Required:** Add a monotonic `sequence_number` per room, or use `id` (UUID v7) as a tiebreaker. Never rely solely on millisecond timestamps for ordering.

### C4. No Rate Limiting on WebSocket Operations
- **Location:** `src/server.ts` `socket.on('op', ...)`
- **Issue:** Any connected client can emit operations as fast as the network allows. The bug section mentions this but the "fixed" code only shows a token bucket snippet, not integrated into the actual server. A single malicious client can DDoS the server and all connected clients.
- **Impact:** Server CPU exhaustion, Redis pub/sub saturation, client browser crashes from excessive re-renders.
- **Fix Required:** Integrate rate limiting into the `op` handler before CRDT application and broadcast.

---

## MAJOR (Outdated, inefficient, or missing robustness)

### M1. Room State is Stored Only in Memory — Lost on Restart
- **Location:** `const rooms = new Map<string, ...>`
- **Issue:** The entire CRDT state and presence data lives in a process-local Map. If the server restarts (deploy, crash, OOM), all rooms are reset to empty. The guide mentions "rebuilt from DB on server start in production" but provides NO code for this.
- **Impact:** Users reconnect after a deploy to a blank canvas. Their presence data is gone.
- **Fix Required:** On startup, load the latest snapshot for each room from PostgreSQL, or lazy-load rooms on first join.

### M2. Snapshots Are Taken Synchronously in the Op Handler
- **Location:** `src/server.ts` inside `socket.on('op')`
- **Issue:** `if (room.opCount % 500 === 0) { await saveSnapshot(...) }` blocks the WebSocket event loop. Saving a large room snapshot to PostgreSQL can take 50-500ms. During this time, no operations for ANY room are processed (Node.js is single-threaded).
- **Impact:** Periodic latency spikes for all users. At scale, snapshotting becomes a global pause.
- **Fix Required:** Offload snapshotting to a background worker or `setImmediate` queue.

### M3. Presence Map is Not Distributed
- **Location:** `room.presence` Map
- **Issue:** Presence data is in-memory only. With the Redis adapter, Socket.io broadcasts messages across servers, but the `rooms` Map (including presence) is NOT shared. User A on Server 1 sees User B on Server 1, but not User C on Server 2.
- **Impact:** Presence lists are incorrect in multi-server deployments.
- **Fix Required:** Store presence in Redis with TTL, or use Socket.io's built-in presence with the adapter.

### M4. No Input Validation on Room IDs
- **Location:** `socket.on('room:join', (roomId: string, ...)`
- **Issue:** `roomId` is used directly as a database key and Socket.io room name. No length limit, no character whitelist. Extremely long room IDs could cause DB issues. Malformed room IDs might collide with Socket.io internal namespaces.
- **Fix Required:** Validate `roomId` against `/^[a-zA-Z0-9_-]{1,64}$/`.

### M5. `compareVectorClocks` Has a Logic Bug
- **Location:** `src/crdt.ts`
- **Issue:**
  ```typescript
  if (!aDominates && !bDominates) return 'equal';
  return 'concurrent';
  ```
  This is wrong. If both are `{ alice: 1 }`, it returns `'equal'`. But if both are `{ alice: 1, bob: 2 }` and `{ alice: 1, bob: 2 }`, it also returns `'equal'`. The actual bug is that `'equal'` and `'concurrent'` are distinct states, but the merge logic doesn't distinguish them. More importantly, if `a = {alice: 1}` and `b = {alice: 1, bob: 1}`, `aDominates` is false, `bDominates` is true, so it returns `'lt'`. That's correct. But the function returns `'equal'` when both are empty or identical, and `'concurrent'` only when they have conflicting values. The real issue is that `compareVectorClocks` in `crdt.ts` returns `'gt' | 'lt' | 'concurrent' | 'equal'` while the inline explanation in Section 3 returns `'before' | 'after' | 'concurrent'`. The `applyOp` method doesn't handle `'equal'` explicitly—it falls through to `return false` for update operations, silently dropping duplicate ops. This is actually okay (idempotency), but it's inconsistent with the teaching text.

### M6. HTTP Endpoints Have No CORS or Auth
- **Location:** `app.get('/replay/:roomId')`, `app.get('/snapshot/:roomId')`
- **Issue:** CORS is set to `origin: '*'` for Socket.io, but the HTTP endpoints have no CORS configuration at all. More importantly, no auth.

---

## MINOR (Typos, inconsistencies, papercuts)

### m1. Vector Clock Type Inconsistency
- **Location:** Section 3 (inline) vs `src/crdt.ts`
- **Issue:** Inline text says `compareVC` returns `'before' | 'after' | 'concurrent'`. The actual code returns `'gt' | 'lt' | 'concurrent' | 'equal'`. Confusing for learners comparing the two.

### m2. `op.payload` is Typed as `any`
- **Location:** `src/types.ts`
- **Issue:** `payload: any` defeats TypeScript's purpose. Should be a discriminated union based on `op.type`.

### m3. `getOperationsSince` Returns `id` as UUID But `Operation.id` is `string`
- **Location:** `src/db.ts`
- **Issue:** The DB query returns `id` but the `Operation` type includes `id: string`. The mapping is implicit and fragile.

### m4. `cb?.({ ok: true })` is Fire-and-Forget for Async
- **Location:** `socket.on('room:join', ...)`
- **Issue:** The callback is called synchronously, but room initialization might fail. If `saveSnapshot` or DB operations fail, the client thinks it joined successfully.

---

## MISSING (Important topics not covered)

### X1. WebSocket Authentication Patterns
- The guide acknowledges auth is needed but provides zero implementation. For a collaborative app, this is the first thing learners need.

### X2. Operational Transform for Text Elements
- The guide mentions OT for text boxes but never shows even a basic implementation. If learners want to add sticky notes with text, they have no guidance.

### X3. Room Deletion / GDPR Right to be Forgotten
- Rooms and operations accumulate forever. No discussion of data retention, deletion, or anonymization.

### X4. Binary Protocol / MessagePack
- At high operation rates, JSON parsing becomes a bottleneck. No mention of binary serialization alternatives.

### X5. Client-Side State Management
- The guide is backend-only but CRDTs require symmetric client-side implementation. No client code is provided, making it impossible to actually test the whiteboard.

---

## EDUCATIONAL QUALITY

| Aspect | Score | Notes |
|--------|-------|-------|
| Concept Introduction | A | CRDTs, vector clocks, OT, presence, optimistic updates are explained with excellent diagrams and intuition. |
| Bug Design | A | All 5 bugs are pedagogically excellent. They represent real failures in production systems (Figma, Excalidraw). |
| Fix Completeness | B | Fixes are mostly good, but some (rate limiting, snapshotting) are snippets rather than integrated solutions. |
| Production Readiness | C | Missing auth is a showstopper. Memory-only state is a showstopper for deploys. |
| Copy-Paste Safety | C | The code will run and mostly work for a demo, but lacks auth and will lose data on restart. |

### Verdict
**The best teaching material of the four, but with dangerous security omissions.** The CRDT content is genuinely good and the bugs are well-chosen. However, deploying this without adding authentication would expose private whiteboard data to the internet. The in-memory state and synchronous snapshotting need to be fixed before this is "production-grade" as claimed.

---

*End of Report — P3*
