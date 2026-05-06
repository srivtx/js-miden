# A08 Evolution: v3 — Add Validation

## State of the System

Every WebSocket message and HTTP API call is validated at runtime. Malformed signaling messages are rejected before they reach the room or relay logic. The server no longer crashes on unexpected payloads.

## What Changed

- **Zod schemas for WebSocket messages.**
  - `joinMessage` — `type: z.literal('join')`, `roomId: z.string().min(1)`.
  - `sdpMessage` — `type: z.enum(['offer', 'answer'])`, `roomId: z.string()`, `targetPeerId: z.string()`, `payload: z.object({ type: z.enum(['offer', 'answer']), sdp: z.string().min(1) })`.
  - `iceMessage` — `type: z.literal('ice-candidate')`, `roomId: z.string()`, `targetPeerId: z.string().optional()`, `payload: z.object({ candidate: z.string(), sdpMid: z.string().nullable(), sdpMLineIndex: z.number().nullable() })`.
- **Max peers enforcement.** `RoomService.getOrCreateRoom()` accepts `maxPeers`. `SignalingService.joinRoom()` rejects if `room.peers.size >= room.maxPeers`.
- **SDP format validation.** The `sdp` field must be a non-empty string. Browsers sometimes send empty offers during renegotiation; these are blocked.
- **Peer ID validation.** WebSocket connections without a `peerId` query parameter are closed with code `4001`.

## What Still Breaks

- **ICE candidate memory leak.** Validation ensures candidates are well-formed, but every valid candidate is still stored forever in `IceRelayService.candidates`.
- **Stale presence.** A peer who disconnects abruptly is not removed from `PresenceService` until someone queries it. Ghost peers accumulate.
- **No rate limiting.** A peer can send 1,000 ICE candidates per second. Each is validated and stored.
- **No TLS.** WebSocket connections use `ws://`. Signaling metadata (including SDP fingerprints) is transmitted in plaintext.

## Code Snapshot (handleMessage)

```typescript
const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), roomId: z.string().min(1) }),
  z.object({ type: z.literal('leave'), roomId: z.string() }),
  z.object({ type: z.literal('offer'), roomId: z.string(), targetPeerId: z.string(), payload: z.object({ type: z.literal('offer'), sdp: z.string() }) }),
  z.object({ type: z.literal('answer'), roomId: z.string(), targetPeerId: z.string(), payload: z.object({ type: z.literal('answer'), sdp: z.string() }) }),
  z.object({ type: z.literal('ice-candidate'), roomId: z.string(), targetPeerId: z.string().optional(), payload: z.object({ candidate: z.string(), sdpMid: z.string().nullable(), sdpMLineIndex: z.number().nullable() }) }),
]);

function handleMessage(peerId: string, raw: unknown) {
  const message = messageSchema.parse(raw);
  switch (message.type) { ... }
}
```

## Architectural Notes

This is the "ICE + SDP validation" stage. The server now understands the structure of WebRTC signaling messages and rejects garbage before it pollutes room state. Room capacity is enforced, preventing 50-peer mesh explosions. However, the server still accumulates ICE candidates without bound and does not clean up after peer disconnections.

## Migration Path to v4

1. Add structured JSON logging for every signaling event (join, leave, offer, answer, ICE relay).
2. Schedule periodic cleanup of stale ICE candidates and ghost peers.
3. Add rate limiting (max 20 candidates per peer per 10 seconds).
