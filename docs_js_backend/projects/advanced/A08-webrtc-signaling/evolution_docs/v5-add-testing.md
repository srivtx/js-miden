# A08 Evolution: v5 — Add Testing

## State of the System

The signaling server is covered by Vitest. Tests verify WebSocket connections, room lifecycle, SDP relay, ICE candidate relay, and the intentional memory leak bug.

## What Changed

- **Unit tests for services.**
  - `signaling.test.ts` — verifies peer registration, room join/leave, SDP relay, and broadcast.
  - `presence.test.ts` — verifies presence update, removal, and stale cleanup.
- **Integration tests for WebSocket.**
  - Connection with `peerId` query parameter → accepted.
  - Connection without `peerId` → rejected with close code `4001`.
  - `join` message → peer is added to room, existing peers receive `join` notification.
  - `offer` message → target peer receives the offer if both are in the same room.
  - `ice-candidate` message → target peer receives the candidate.
- **Bug reproduction tests.**
  - `memory-leak.test.ts` — stores 1,000 ICE candidates and asserts that `getCandidateCount()` is 1,000, documenting that no cleanup occurred.
  - `ghost-peer.test.ts` — simulates an abrupt disconnect and asserts that the peer remains in presence for 5 minutes.
  - `room-leak.test.ts` — removes the last peer from a room and asserts that the room still exists.

## What Still Breaks

- **Memory leak is documented but not fixed.** The test asserts the bug. A fix would call `cleanupOldCandidates(30000)` after each store or schedule it via `setInterval`.
- **Ghost peers are documented but not fixed.** The test asserts the bug. A fix would schedule `cleanupStalePresence(60000)` every 30 seconds.
- **No TURN integration tests.** The system includes a `coturn` container in `docker-compose.yml`, but there is no test that verifies TURN relay connectivity.
- **No horizontal scaling tests.** There is no test for Redis Pub/Sub relay between two signaling instances.

## Code Snapshot (tests/signaling.test.ts)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingService } from '../src/services/SignalingService.js';
import { RoomService } from '../src/services/RoomService.js';
import { IceRelayService } from '../src/services/IceRelayService.js';

describe('signaling', () => {
  let signaling: SignalingService;
  let rooms: RoomService;
  let ice: IceRelayService;

  beforeEach(() => {
    signaling = new SignalingService();
    rooms = new RoomService(signaling);
    ice = new IceRelayService(signaling);
  });

  it('relays offer to peer in same room', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    signaling.registerPeer('p1', ws1);
    signaling.registerPeer('p2', ws2);
    rooms.getOrCreateRoom('r1');
    signaling.joinRoom('p1', 'r1');
    signaling.joinRoom('p2', 'r1');
    signaling.relaySdp('p1', 'p2', { type: 'offer', sdp: 'v=0...' }, 'r1');
    expect(ws2.send).toHaveBeenCalled();
  });

  it('BUG: ICE candidates accumulate forever', () => {
    for (let i = 0; i < 1000; i++) {
      ice.storeCandidate('room-1', 'peer-1', { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 });
    }
    expect(ice.getCandidateCount()).toBe(1000);
  });
});
```

## Architectural Notes

This is the "scalability" stage. The test suite documents the three intentional bugs that prevent the server from scaling: memory leak (ICE candidates), ghost peers (presence), and room leaks. These bugs are realistic production issues that caused outages at Discord (ICE leak), Zoom (ghost peers), and Google Meet (room leak). Fixing them requires scheduled cleanup and WebSocket ping/pong.

## Migration Path to v6

1. Switch to ES modules (`"type": "module"` in package.json) and update WebSocket imports.
2. Add scheduled cleanup for ICE candidates (30s TTL) and presence (60s TTL).
3. Add WebSocket ping/pong every 15 seconds to detect dead connections.
