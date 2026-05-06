# Architecture

## System Architecture

The WebRTC Signaling Server follows a microservices pattern with four core services communicating in-memory.

```
┌─────────────────────────────────────────────────────────────┐
│                        Express HTTP API                      │
│  GET /api/health     GET /api/rooms/:id    GET /api/ice/... │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     WebSocket Server                         │
│  Handles: join, leave, offer, answer, ice-candidate         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Signaling   │    │    Room       │    │   Presence    │
│   Service     │    │   Service     │    │   Service     │
└───────────────┘    └───────────────┘    └───────────────┘
        │
        ▼
┌───────────────┐
│  ICE Relay    │
│   Service     │
└───────────────┘
```

## Data Flow

### Peer Join Flow
1. Browser opens WebSocket with `peerId`
2. `SignalingService.registerPeer()` stores the WebSocket
3. Browser sends `join` message with `roomId`
4. `RoomService.getOrCreateRoom()` creates room if needed
5. `SignalingService.joinRoom()` adds peer to room set
6. `PresenceService.updatePresence()` marks peer online
7. Existing room members receive `join` notification

### SDP Exchange Flow
1. Peer A creates offer via `RTCPeerConnection.createOffer()`
2. Offer sent via WebSocket `type: 'offer'` with `targetPeerId`
3. Server validates both peers are in same room
4. `SignalingService.relaySdp()` forwards to target
5. Peer B receives offer, creates answer
6. Answer sent back via same path

### ICE Candidate Flow
1. Peer A generates candidate via `onicecandidate`
2. Candidate sent via WebSocket `type: 'ice-candidate'`
3. `IceRelayService.relayCandidate()` stores and forwards
4. **BUG**: Candidates are stored but never cleaned up

## Deployment Architecture

```
                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Signaling  │  │ Signaling  │  │ Signaling  │
    │  Server 1  │  │  Server 2  │  │  Server 3  │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    ┌────────────┐
                    │   Redis    │
                    │  Pub/Sub   │
                    └────────────┘
```

## Scale Considerations

- **Horizontal Scaling**: Use Redis Pub/Sub to broadcast messages across server instances
- **STUN/TURN**: Deploy TURN servers (coturn) for NAT traversal fallback
- **Room Limits**: Default max 8 peers per room for video calls (bandwidth constraint)

## References

[1] J. Rosenberg, "Interactive Connectivity Establishment (ICE)," RFC 8445, 2018.
[2] M. Thomson, "WebRTC 1.0: Real-Time Communication Between Browsers," W3C, 2021.
[3] A. Bergkvist et al., "WebRTC Architecture," W3C Working Draft, 2013.