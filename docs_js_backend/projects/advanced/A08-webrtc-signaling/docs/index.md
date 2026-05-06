# A08: WebRTC Signaling Server

## Overview

The WebRTC Signaling Server enables peer-to-peer real-time communication by exchanging Session Description Protocol (SDP) offers/answers and ICE candidates between browsers. The server does NOT handle media traffic—signaling and media paths are strictly separated [1].

## What This Project Does

- **SDP Exchange**: Relays WebRTC session descriptions (offers/answers) between peers
- **ICE Candidate Relay**: Forwards network candidates so peers can establish direct connections
- **Room Management**: Groups peers into rooms for multi-party calls
- **Presence Tracking**: Monitors which peers are online in each room

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐     WebSocket     ┌─────────────┐
│  Browser A  │◄──────────────────►│  Signaling Server │◄────────────────►│  Browser B  │
│  (Peer 1)   │    Signaling Path  │   (This Project)  │   Signaling Path │  (Peer 2)   │
└──────┬──────┘                    └──────────────────┘                  └──────┬──────┘
       │                                                                         │
       └───────────────────────  Direct P2P Media Path  ─────────────────────────┘
                            (Audio/Video/Data - NOT through server)
```

## Key Design Decisions

1. **Signaling vs Media Path Separation**: The server only handles control messages. All media flows directly between peers using SRTP [2].
2. **P2P First, Relay as Fallback**: ICE tries direct connection first, then STUN, then TURN [3].
3. **Room-Based Grouping**: Peers join rooms; messages only broadcast within a room.

## Services

| Service | Responsibility |
|---------|---------------|
| SignalingService | Peer registration, SDP relay, room join/leave |
| RoomService | Room lifecycle, stats, cleanup |
| IceRelayService | ICE candidate storage and forwarding |
| PresenceService | Online/offline tracking per room |

## Known Issues

See [troubleshooting.md](troubleshooting.md) for the memory leak bug in ICE candidate cleanup.

## References

[1] WebRTC 1.0: Real-Time Communication Between Browsers, W3C Recommendation. https://www.w3.org/TR/webrtc/
[2] RFC 3711: The Secure Real-time Transport Protocol (SRTP). https://tools.ietf.org/html/rfc3711
[3] RFC 8445: Interactive Connectivity Establishment (ICE). https://tools.ietf.org/html/rfc8445
[4] RFC 5389: Session Traversal Utilities for NAT (STUN). https://tools.ietf.org/html/rfc5389