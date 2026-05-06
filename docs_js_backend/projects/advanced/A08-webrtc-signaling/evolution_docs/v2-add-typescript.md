# A08 Evolution: v2 — Add TypeScript

## State of the System

The signaling server has grown from a broadcast echo to a structured WebSocket application with room management, typed messages, and dedicated service classes.

## What Changed

- **Typed message protocol.**
  - `SignalingMessage` — `type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'error'`, `roomId`, `peerId`, `targetPeerId?`, `payload?`, `timestamp`.
  - `RTCSessionDescriptionInit` — `type`, `sdp`.
  - `RTCIceCandidateInit` — `candidate`, `sdpMid`, `sdpMLineIndex`.
  - `Room` — `id`, `peers: Set<string>`, `createdAt`, `maxPeers`.
  - `Peer` — `id`, `ws: WebSocket`, `roomId`, `connectedAt`.
- **Service decomposition.**
  - `SignalingService` — peer registration, room join/leave, SDP relay, broadcast.
  - `RoomService` — room creation, stats, empty-room cleanup.
  - `IceRelayService` — candidate storage and relay.
  - `PresenceService` — last-seen tracking and stale cleanup.
- **Room-scoped messaging.** `relaySdp()` validates that both sender and target are in the same `roomId` before forwarding. This replaces the global broadcast of v1.

## What Still Breaks

- **No runtime validation of WebSocket messages.** A client can send `{ type: 'join', roomId: 123 }` (number instead of string) and the server crashes on `roomService.getOrCreateRoom(123)`.
- **ICE candidate memory leak.** `IceRelayService.storeCandidate()` pushes every candidate into a `Map` but never calls `cleanupOldCandidates()`. After 24 hours with 1,000 peers, the process holds 2 GB+ of stale candidates.
- **Stale presence.** A peer who disconnects abruptly (WiFi drop) is not removed from `PresenceService` until a manual cleanup runs — but there is no scheduled cleanup.
- **No TURN configuration.** The server relays ICE candidates but does not provide TURN credentials. Peers behind symmetric NAT cannot establish P2P connections.

## Code Snapshot (services/SignalingService.ts)

```typescript
export class SignalingService {
  private peers: Map<string, Peer> = new Map();
  private rooms: Map<string, Room> = new Map();

  relaySdp(peerId: string, targetPeerId: string, sdp: RTCSessionDescriptionInit, roomId: string): boolean {
    const peer = this.peers.get(peerId);
    const target = this.peers.get(targetPeerId);
    if (!peer || !target || peer.roomId !== roomId || target.roomId !== roomId) {
      return false; // same-room validation
    }
    return this.sendToPeer(targetPeerId, { type: sdp.type === 'offer' ? 'offer' : 'answer', roomId, peerId, targetPeerId, payload: sdp, timestamp: Date.now() });
  }
}
```

## Architectural Notes

This is the "room management" stage. The server now understands the WebRTC signaling lifecycle: peers join rooms, exchange offers/answers, and relay ICE candidates. The type system ensures that handlers do not confuse an `offer` with an `ice-candidate`. However, the server still trusts all client input and leaks memory by retaining transient ICE data forever.

## Migration Path to v3

1. Add Zod schemas for every inbound WebSocket message.
2. Validate SDP format before relay (ensure `sdp` is a non-empty string).
3. Enforce `maxPeers` per room to prevent mesh explosions.
