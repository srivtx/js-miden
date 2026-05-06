# A08 Evolution: v7 — Production Setup

## State of the System

The WebRTC signaling server is deployed as a Dockerized, horizontally scalable cluster with Redis Pub/Sub, WSS/TLS, coturn for TURN relay, and automatic cleanup.

## What Changed

- **Docker + docker-compose.** `docker-compose.yml` runs the signaling server, Redis, and coturn.
- **Redis Pub/Sub.** `SignalingService` uses `ioredis` to publish messages to a Redis channel and subscribe to peer channels. Multiple server instances share state via Redis.
- **WSS/TLS.** The WebSocket server uses `wss://` with TLS certificates. Clients connect securely; signaling metadata (SDP fingerprints) is encrypted in transit.
- **Coturn TURN server.** `coturn/coturn` container provides STUN and TURN relay. Credentials are generated dynamically via a shared secret.
- **Automatic cleanup.** `setInterval` runs every 30 seconds: `cleanupOldCandidates(30000)` removes ICE candidates older than 30 seconds. `cleanupStalePresence(60000)` removes peers absent for 60 seconds. `cleanupEmptyRooms()` removes rooms with zero peers.
- **WebSocket ping/pong.** The server sends ping frames every 15 seconds. Peers that do not respond within 30 seconds are evicted.
- **Rate limiting.** `express-rate-limit` restricts HTTP API calls. WebSocket messages are rate-limited per peer (max 20 ICE candidates per 10 seconds).
- **Prometheus metrics.** `signaling_peers_total`, `signaling_rooms_total`, `signaling_ice_candidates_total`, `signaling_messages_relayed_total`.
- **Horizontal scaling.** Kubernetes HPA scales pods based on `signaling_peers_total`. New pods join the Redis Pub/Sub mesh automatically.

## What Still Breaks

- **No congestion control awareness.** The signaling server does not know if the P2P media path is working. It cannot suggest switching to TURN or lowering resolution.
- **No SFU fallback.** Mesh architecture does not scale beyond 8 peers. Large groups require an SFU (e.g., mediasoup).
- **No end-to-end encryption for signaling.** WSS encrypts transport, but the server can still read SDP. Double Ratchet (Signal Protocol) would encrypt signaling content.
- **No geographic affinity.** Redis Pub/Sub is global. Cross-region latency adds 50–100 ms to signaling messages.

## Code Snapshot (docker-compose.yml)

```yaml
version: '3.8'
services:
  signaling:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - TURN_SECRET=change-me
      - TLS_CERT=/certs/server.crt
      - TLS_KEY=/certs/server.key
    depends_on:
      - redis
      - turn
  redis:
    image: redis:7-alpine
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
      --static-auth-secret=change-me
      --realm=webrtc.local
```

## Architectural Notes

This is the "production" stage. The system now scales horizontally via Redis, provides TURN fallback for symmetric NAT, and cleans up memory automatically. WSS protects signaling metadata. However, the mesh architecture limits group size, and the server lacks congestion control awareness.

## Future Work

1. Add SFU fallback for groups > 8 peers (mediasoup integration).
2. Add geographic affinity with regional Redis clusters.
3. Implement Signal Protocol for end-to-end encrypted signaling.
4. Add WebRTC stats API (`pc.getStats()`) monitoring.
