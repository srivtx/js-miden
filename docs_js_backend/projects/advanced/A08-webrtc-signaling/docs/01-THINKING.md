# Thinking Process

## Mental Models

Think of WebRTC signaling as a **matchmaking service** for browsers:

```
Phase 1: Registration
  Browser A ──► Signaling Server: "I am peer-A, I want to join room-1"
  Browser B ──► Signaling Server: "I am peer-B, I want to join room-1"

Phase 2: SDP Exchange (The "Handshake")
  Browser A creates offer ──► Server relays ──► Browser B receives offer
  Browser B creates answer ──► Server relays ──► Browser A receives answer

Phase 3: ICE Candidate Relay (The "Address Book")
  Browser A: "Try connecting to 192.168.1.5:5000" (host candidate)
  Browser A: "Try connecting to 74.12.34.56:5000" (STUN-reflexive)
  Browser A: "Try connecting via turn.example.com:3478" (TURN relay)
  Server forwards each candidate to Browser B

Phase 4: P2P Established
  Browser A ◄─────────────────SRTP/UDP─────────────────► Browser B
  Server is no longer needed for media
```

## The Hot Path

Call setup latency is the critical metric:
```
Browser A: createOffer()      ──► 50ms
           send offer via WS   ──► 20ms
Browser B: receive offer      ──► 0ms
           createAnswer()      ──► 50ms
           send answer via WS  ──► 20ms
Browser A: receive answer     ──► 0ms
           ICE checks complete  ──► 200-500ms
─────────────────────────────────────────────────
Total call setup: ~350-650ms
```

Every millisecond of signaling delay adds to user-perceived "call connection time."

## The Danger Zone

1. **ICE Candidate Memory Leak**: `IceRelayService` stores every ICE candidate in a Map but never cleans them up. After 24 hours with 1,000 active peers, the process uses 2GB+ RAM and crashes.
2. **Stale Presence**: A peer disconnects abruptly (WiFi drop). The server thinks they're still online. Other peers try to call a ghost.
3. **Room Leaks**: Empty rooms are not cleaned up. Memory grows with abandoned rooms.
4. **Signaling MITM**: If the signaling server is compromised, an attacker can inject malicious SDP to redirect media through their own peer.

## Question Everything

- **Why WebSocket and not HTTP polling?** WebSocket provides full-duplex, low-latency messaging. HTTP polling adds 100-500ms latency per message. SSE is server-push only — can't send offers from client.
- **Why not put media through the server?** A server relaying 8 peers × 2 Mbps video = 16 Mbps per room. With 1,000 rooms, that's 16 Gbps. P2P offloads bandwidth to clients.
- **Why ICE instead of just using public IPs?** 90%+ of users are behind NAT. Their public IP is unknown to their local network stack. ICE discovers all viable paths.
- **What if both peers are behind symmetric NAT?** TURN relay is mandatory. 15-20% of calls require TURN fallback.

## The "What If" Game

- **What if the signaling server restarts mid-call?** Already-established P2P connections survive. New peers can't join until the server recovers. This is why production systems use Redis Pub/Sub to share state across signaling instances.
- **What if a peer sends 10,000 fake ICE candidates?** Rate limiting is required. Without it, a single peer can DoS the server's memory.
- **What if two peers in the same room both send offers?** This is a "glare" condition. WebRTC uses "polite peer" negotiation — one peer aborts and accepts the other's offer.
- **What if the TURN server is down?** Peers behind symmetric NAT cannot connect. Calls fail silently after ICE timeout (~10s).
