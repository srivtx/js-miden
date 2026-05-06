# The Problem

## What Are We Building?
A WebRTC Signaling Server that enables peer-to-peer (P2P) real-time communication between browsers. The server handles Session Description Protocol (SDP) offers/answers, ICE candidate relay, room management, and presence tracking. Critically, the server does NOT handle media traffic — audio, video, and data flow directly between peers via encrypted SRTP/DTLS.

```
Signaling Path (through server):
┌─────────────┐     WebSocket      ┌──────────────────┐     WebSocket     ┌─────────────┐
│  Browser A  │◄──────────────────►│  Signaling Server │◄────────────────►│  Browser B  │
│  (Peer 1)   │    JSON control    │   (This Project)  │    JSON control   │  (Peer 2)   │
└──────┬──────┘                    └──────────────────┘                  └──────┬──────┘
       │                                                                         │
       └───────────────────────  Direct P2P Media Path  ─────────────────────────┘
                           (SRTP/UDP — NOT through server)
```

## Why Does This Problem Exist?
WebRTC is designed to be peer-to-peer, but peers cannot discover each other without a signaling channel. NATs and firewalls hide private IPs, so peers need ICE (Interactive Connectivity Establishment) to find viable connection paths. The signaling server is the bootstrap mechanism that solves:
1. **Session Negotiation**: Exchange SDP to agree on codecs, encryption keys, and network parameters
2. **NAT Traversal**: Exchange ICE candidates so peers can punch holes through NATs or fall back to TURN relays
3. **Room Management**: Group peers into rooms for multi-party calls

Without signaling, WebRTC cannot establish its first connection.

## Who Will Use It?
- **Video conferencing apps**: Jitsi, Zoom (initially), Google Meet all use signaling servers
- **Gaming platforms**: Low-latency P2P game state synchronization
- **IoT devices**: Direct camera-to-browser streaming without a media server
- **File sharing apps**: WebRTC data channels for P2P file transfer

## Constraints
- **Latency**: Signaling messages must be delivered in < 100ms (not on the media hot path, but slow signaling delays call setup)
- **Scale**: Support 10,000 concurrent WebSocket connections per instance; horizontal scaling via Redis Pub/Sub
- **Security**: Signaling messages contain SDP fingerprints — must be authenticated to prevent MITM attacks
- **Reliability**: ICE candidates must be relayed even if one peer temporarily disconnects

## What We're NOT Building
- We are NOT building a media server (no audio/video processing)
- We are NOT building an SFU (Selective Forwarding Unit) or MCU (Multipoint Control Unit)
- We are NOT handling the actual WebRTC peer connection API (that lives in the browser)
- We are NOT implementing DTLS/SRTP encryption (handled natively by browsers)

## Real-World Context
In 2020, Discord experienced intermittent call failures during peak load because their signaling servers dropped ICE candidates under memory pressure. Calls would ring but never connect. The root cause was a memory leak in candidate buffering — exactly the bug this project demonstrates.
