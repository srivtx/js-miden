# Architecture Decisions

## Decision 1: Signaling Transport Protocol

### Option A: WebSocket
**Pros:** Full-duplex, low latency (~5ms), persistent connection, binary or text frames, native browser support.
**Cons:** Requires TCP connection per client, harder to scale horizontally (needs sticky sessions or shared state), firewall rules must allow WebSocket upgrade.

### Option B: HTTP Long-Polling
**Pros:** Works through all firewalls/proxies, simple to implement, no WebSocket-specific infrastructure.
**Cons:** High latency (100-500ms per message), high overhead (HTTP headers on every message), terrible for real-time signaling where offer/answer must be rapid.

### Option C: Server-Sent Events (SSE)
**Pros:** Simple HTTP-based push, automatic reconnection, works over HTTP/2 multiplexing.
**Cons:** Unidirectional (server→client only). WebRTC signaling requires client→server messages (offers, answers, ICE candidates). Not suitable.

### Option D: WebTransport (HTTP/3)
**Pros:** Low latency, datagram support, modern replacement for WebSocket.
**Cons:** Limited browser support (2025: Chrome only, Firefox behind flag). Too bleeding-edge for production.

### What We Chose: WebSocket
**Why:** Full-duplex is non-negotiable for signaling. WebSocket is the industry standard with 99%+ browser support.

---

## Decision 2: Media Path Architecture

### Option A: Mesh (P2P) — What We Use for Media
**Pros:** No server bandwidth cost, lowest possible latency (direct path), trivial privacy (server never sees media).
**Cons:** Each peer uploads to N-1 peers. With 8 peers, each uploads 7 video streams. CPU/bandwidth scales linearly with group size.

### Option B: SFU (Selective Forwarding Unit)
**Pros:** Each peer uploads 1 stream. Server forwards to N-1 peers. Scales to 50+ peers.
**Cons:** Server must handle high bandwidth (N × bitrate). Adds 10-30ms latency. Complex simulcast routing.

### Option C: MCU (Multipoint Control Unit)
**Pros:** Each peer uploads 1 and downloads 1 composite stream. Lowest client bandwidth.
**Cons:** Server CPU intensive (video decoding + encoding). Highest latency (50-100ms). Most expensive.

### What We Chose: Mesh (P2P)
**Why:** For educational scope and small groups (<8 peers), Mesh is simplest. The signaling server is already designed to be stateless regarding media.

---

## Decision 3: NAT Traversal Strategy

### Option A: STUN Only
**Pros:** Free (public STUN servers), no infrastructure, works for ~80% of NAT types.
**Cons:** Fails for symmetric NAT (~15-20% of users). No privacy (IP exposed to peer).

### Option B: STUN + TURN
**Pros:** TURN relays media through a server, guaranteeing connectivity even for symmetric NAT. Industry standard.
**Cons:** TURN server bandwidth costs (~$0.10/GB). Adds 10-50ms relay latency. Requires credentials management.

### Option C: ICE Lite
**Pros:** Simpler implementation on server side. No STUN/TURN client logic.
**Cons:** Only works if one side has a public IP. Not suitable for browser-to-browser.

### What We Chose: STUN + TURN
**Why:** Production WebRTC requires TURN fallback. The project includes a `coturn` Docker container for testing.

---

## Decision 4: Horizontal Scaling

### Option A: Single Instance (In-Memory State)
**Pros:** Simple, zero latency for state access, no external dependencies.
**Cons:** Single point of failure, hard ceiling on connection count (~10K per instance), no zero-downtime deploys.

### Option B: Multiple Instances + Redis Pub/Sub
**Pros:** Linear scalability, zero-downtime deploys, shared state across instances.
**Cons:** Adds Redis as a dependency, 1-5ms latency for cross-instance messaging, complexity of message serialization.

### What We Chose: In-Memory with Redis Architecture Documented
**Why:** The base project uses in-memory Maps for simplicity. The architecture docs show how to extend to Redis Pub/Sub for production scaling.
