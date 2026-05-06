# Critic Review

## Technical Review
A senior real-time systems engineer would say:

- **"No TURN server in the default configuration. 15-20% of your users will fail to connect."**
  The `docker-compose.yml` includes coturn, but the default client config might not reference it. Production WebRTC MUST have TURN fallback.

- **"No horizontal scaling. This is a single point of failure."**
  The in-memory Maps (`peers`, `rooms`, `candidates`) are lost on restart. Two signaling instances cannot communicate. For production, Redis Pub/Sub is mandatory.

- **"No rate limiting on ICE candidates. A single peer can DoS the server."**
  A malicious peer can send thousands of fake candidates per second. Each is stored in memory. Rate limiting (max 20 candidates/peer/10s) is required.

- **"No congestion control awareness. The signaling server doesn't know if the P2P path is working."**
  WebRTC has its own congestion control (GCC), but the signaling server is blind to it. If a call is choking, the server can't suggest switching to TURN or lowering resolution.

- **"WebSocket messages are plaintext. No TLS/WSS in the example."**
  `ws://` instead of `wss://` means signaling metadata (including SDP fingerprints) can be intercepted. Use `wss://` in production.

## Security Review

- **Man-in-the-Middle**: Without WSS, an attacker can intercept and modify SDP offers. They can redirect media to their own peer.
- **Authentication**: No auth on WebSocket connection. Anyone with the URL can join any room.
- **Room Enumeration**: Sequential room IDs (room-1, room-2) are guessable. Use UUIDs.
- **SDP Injection**: No validation of SDP payloads. A malicious client could send an SDP with excessive bandwidth requirements or unsupported codecs.

## Educational Review

- **What's missing**: A diagram showing the complete ICE state machine (gathering → checking → connected → completed → failed).
- **What's confusing**: The difference between STUN and TURN is subtle. Students often think STUN "punches holes" — it doesn't. STUN only discovers the hole's public address.
- **What's excellent**: The intentional memory leak is a realistic production bug. The fix teaches TTL-based cleanup patterns applicable to any stateful server.
- **Suggested addition**: A chapter on WebRTC stats API (`pc.getStats()`). Show how to monitor bitrate, packet loss, and jitter in real-time.
- **Suggested addition**: Simulcast explanation. Modern WebRTC sends multiple quality layers. The SFU chooses which layer to forward to each peer based on their bandwidth.

## Fixes Applied in This Revision
- Added explicit `cleanupOldCandidates` invocation pattern.
- Added `cleanupEmptyRooms` to `RoomService`.
- Added `cleanupStalePresence` to `PresenceService`.
- Documented Redis Pub/Sub scaling architecture.

## Grade: B
Good introduction to WebRTC signaling with a realistic memory leak bug. Missing production hardening (WSS, auth, rate limiting, horizontal scaling). The Mesh architecture choice limits scalability but is appropriate for educational scope.
