# Step-by-Step Build Guide

## Step 1: WebSocket Server Setup

```typescript
import { WebSocketServer } from 'ws';
import express from 'express';

const app = express();
const httpServer = app.listen(3000);

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const peerId = url.searchParams.get('peerId');
  if (!peerId) { ws.close(4001, 'Missing peerId'); return; }

  signalingService.registerPeer(peerId, ws);
  console.log(`Peer ${peerId} connected`);

  ws.on('message', (data) => handleMessage(peerId, data));
  ws.on('close', () => signalingService.removePeer(peerId));
});
```

### Common Mistakes
- **Mistake**: Not validating `peerId` on connection.
- **Why it breaks**: Malicious clients can connect without identification, making message routing impossible.
- **How to avoid**: Reject connections without `peerId`. Validate format.

---

## Step 2: Room Management

```typescript
export class RoomService {
  private rooms: Map<string, Room> = new Map();

  getOrCreateRoom(roomId: string, maxPeers = 8): Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        peers: new Set(),
        createdAt: Date.now(),
        maxPeers,
      });
    }
    return this.rooms.get(roomId)!;
  }

  cleanupEmptyRooms(): number {
    let cleaned = 0;
    for (const [roomId, room] of this.rooms) {
      if (room.peers.size === 0) {
        this.rooms.delete(roomId);
        cleaned++;
      }
    }
    return cleaned;
  }
}
```

### Common Mistakes
- **Mistake**: Not enforcing `maxPeers`.
- **Why it breaks**: A 50-peer Mesh call destroys everyone's bandwidth.
- **How to avoid**: Reject `joinRoom` if `room.peers.size >= maxPeers`.

---

## Step 3: SDP Relay

```typescript
relaySdp(peerId: string, targetPeerId: string, sdp: RTCSessionDescriptionInit, roomId: string): boolean {
  const peer = this.peers.get(peerId);
  const target = this.peers.get(targetPeerId);

  // CRITICAL: Verify both peers are in the same room
  if (!peer || !target || peer.roomId !== roomId || target.roomId !== roomId) {
    return false;
  }

  return this.sendToPeer(targetPeerId, {
    type: sdp.type === 'offer' ? 'offer' : 'answer',
    roomId,
    peerId,
    targetPeerId,
    payload: sdp,
    timestamp: Date.now(),
  });
}
```

### Common Mistakes
- **Mistake**: Not validating that both peers are in the same room.
- **Why it breaks**: A peer in "room-a" could send an offer to a peer in "room-b", causing cross-room leaks or crashes.
- **How to avoid**: Always check `peer.roomId === target.roomId` before relaying.

---

## Step 4: ICE Candidate Relay (with cleanup)

```typescript
export class IceRelayService {
  private candidates: Map<string, IceCandidateEntry[]> = new Map();

  storeCandidate(roomId: string, peerId: string, candidate: RTCIceCandidateInit): string {
    const entry = { id: generateId(), roomId, peerId, candidate, timestamp: Date.now() };
    const roomCandidates = this.candidates.get(roomId) || [];
    roomCandidates.push(entry);
    this.candidates.set(roomId, roomCandidates);

    // FIX: Cleanup old candidates to prevent memory leak
    this.cleanupOldCandidates(30000);
    return entry.id;
  }

  cleanupOldCandidates(maxAgeMs = 30000): number {
    let cleaned = 0;
    const now = Date.now();
    for (const [roomId, entries] of this.candidates) {
      const filtered = entries.filter(e => now - e.timestamp < maxAgeMs);
      cleaned += entries.length - filtered.length;
      if (filtered.length === 0) this.candidates.delete(roomId);
      else this.candidates.set(roomId, filtered);
    }
    return cleaned;
  }
}
```

### Common Mistakes
- **Mistake**: Not cleaning up ICE candidates.
- **Why it breaks**: Each peer generates 5-15 ICE candidates. With 1,000 peers, that's 15,000 candidate objects accumulating forever. Server crashes from memory exhaustion.
- **How to avoid**: Call `cleanupOldCandidates()` periodically via `setInterval` or after each relay.

---

## Step 5: Presence Tracking

```typescript
export class PresenceService {
  private presence: Map<string, { peerId: string; roomId: string; lastSeen: number }> = new Map();

  updatePresence(peerId: string, roomId: string): void {
    this.presence.set(peerId, { peerId, roomId, lastSeen: Date.now() });
  }

  cleanupStalePresence(timeoutMs = 60000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [peerId, data] of this.presence) {
      if (now - data.lastSeen > timeoutMs) {
        this.presence.delete(peerId);
        cleaned++;
      }
    }
    return cleaned;
  }
}
```

### Common Mistakes
- **Mistake**: Not cleaning up stale presence entries.
- **Why it breaks**: Peers that disconnect abruptly (WiFi drop, browser crash) remain in presence forever. Ghost peers accumulate.
- **How to avoid**: Run `cleanupStalePresence` every 60 seconds via `setInterval`.

---

## Step 6: TURN Server Setup

```yaml
# docker-compose.yml
turn:
  image: coturn/coturn:latest
  ports:
    - "3478:3478"
    - "10000-10100:10000-10100/udp"
  command: >
    turnserver
    --listening-port=3478
    --fingerprint
    --lt-cred-mech
    --user=user:pass
    --realm=webrtc.local
```

### Common Mistakes
- **Mistake**: Not opening UDP port range for TURN relay.
- **Why it breaks**: TURN relays media over UDP. If the port range is blocked, fallback fails.
- **How to avoid**: Open 10,000-10,100/udp in firewall rules. Use a cloud load balancer that supports UDP.
