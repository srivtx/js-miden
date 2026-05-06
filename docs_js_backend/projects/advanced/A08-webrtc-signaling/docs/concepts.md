# Core Concepts

## WebRTC Signaling

WebRTC requires a signaling mechanism to exchange metadata before establishing a peer-to-peer connection. Signaling is NOT specified by WebRTC—any message channel works [1].

### Why Signaling is Needed

1. **Session Negotiation**: Exchange SDP offers/answers to agree on codecs, formats
2. **Network Information**: Exchange ICE candidates to find connection paths
3. **Security**: Exchange DTLS fingerprint for encryption

### Signaling vs Media Path

| Aspect | Signaling Path | Media Path |
|--------|---------------|------------|
| Protocol | WebSocket/HTTP | SRTP/UDP |
| Through Server | Yes | No (P2P) |
| Bandwidth | Low (~1 KB/s) | High (video: ~2 Mbps) |
| Latency Sensitivity | Low | High |

## ICE (Interactive Connectivity Establishment)

ICE is a framework for NAT traversal that tries multiple connection paths [2]:

1. **Host Candidate**: Direct local IP
2. **Server Reflexive**: Public IP via STUN
3. **Relay**: TURN server relay

```
Peer A ────► STUN Server ◄──── Peer B
   │           (discover IPs)      │
   └───────────────────────────────┘
            (try direct P2P)

If P2P fails:
Peer A ────► TURN Server ◄──── Peer B
   │         (relay media)       │
```

## SDP (Session Description Protocol)

SDP describes multimedia sessions:
- `offer`: Initiator's capabilities
- `answer`: Responder's accepted configuration

## NAT Traversal

NAT (Network Address Translation) hides private IPs behind public IPs. WebRTC needs STUN/TURN to traverse NAT [3]:

| NAT Type | STUN Works? | TURN Needed? |
|----------|-------------|--------------|
| Full Cone | Yes | No |
| Restricted Cone | Usually | Sometimes |
| Symmetric | No | Yes |

## SFU vs MCU vs Mesh

For group calls with N peers:

| Architecture | Uploads | Downloads | Server CPU |
|-------------|---------|-----------|------------|
| Mesh (P2P) | N-1 | N-1 | None |
| SFU | 1 | N-1 | Low |
| MCU | 1 | 1 | High |

This project uses **Mesh** (pure P2P) for the media path.

## References

[1] A. Bergkvist et al., "WebRTC 1.0: Real-Time Communication Between Browsers," W3C, 2021.
[2] J. Rosenberg, "Interactive Connectivity Establishment (ICE)," RFC 8445, 2018.
[3] J. Rosenberg et al., "STUN - Session Traversal Utilities for NAT," RFC 5389, 2008.
[4] J. Lennox et al., "Traversal Using Relays around NAT (TURN)," RFC 8656, 2020.