# Concepts Explained

## Concept: WebRTC Signaling

### WHAT Is It?
WebRTC requires a signaling mechanism to exchange metadata before establishing a peer-to-peer connection. **Signaling is NOT specified by WebRTC** — any message channel works (WebSocket, HTTP, QR code, carrier pigeon).

### WHY Is It Needed?
1. **Session Negotiation**: Exchange SDP offers/answers to agree on codecs, formats, and encryption keys
2. **Network Information**: Exchange ICE candidates to find connection paths through NATs
3. **Security**: Exchange DTLS fingerprint for encryption verification

### HOW Does It Work?
```
Browser A                          Signaling Server                     Browser B
   │ ─────── createOffer() ───────▶ │                                    │
   │ ─────── send offer ──────────▶ │ ─────── relay offer ─────────────▶ │
   │                                │                                    │ ── setRemoteDescription(offer)
   │                                │                                    │ ── createAnswer()
   │ ────── receive answer ───────◀ │ ◀────── send answer ───────────── │
   │ ── setRemoteDescription(ans)   │                                    │
```

### WRONG vs RIGHT

**WRONG** — Putting media through the signaling server:
```
Browser A ──► Signaling Server ──► Browser B
              (relaying video!)
```
This destroys the P2P benefit. The server becomes a bandwidth bottleneck and a privacy risk.

**RIGHT** — Strict separation:
```
Browser A ◄────────── SRTP/UDP ──────────► Browser B
Signaling server only handles control messages (offer/answer/ICE)
```

---

## Concept: ICE (Interactive Connectivity Establishment)

### WHAT Is It?
ICE is a framework for NAT traversal that tries multiple connection paths in priority order.

### WHY Do We Need It?
Most users are behind NAT. Their local IP (192.168.x.x) is not routable from the internet. ICE discovers all possible paths and tests them.

### HOW Does It Work?
```
Priority Order:
1. Host Candidate: Direct local IP (192.168.1.5:5000)
   └── Fastest, but only works on same LAN

2. Server Reflexive (STUN): Public IP via STUN server
   Peer A ──► STUN Server ◄─── Peer B
   └── Works for 80% of NAT types

3. Relay (TURN): Media relayed through TURN server
   Peer A ──► TURN Server ◄─── Peer B
   └── Works for 100% of cases, but adds latency and cost
```

ICE gathers candidates, sends them via signaling, then performs connectivity checks (STUN binding requests) on each candidate pair.

### WRONG vs RIGHT

**WRONG** — Only trying host candidates:
```javascript
const pc = new RTCPeerConnection({ iceServers: [] });
```
This only works if both peers are on the same local network. Fails for 99% of internet users.

**RIGHT** — Configuring STUN + TURN:
```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
  ]
});
```

---

## Concept: SDP (Session Description Protocol)

### WHAT Is It?
SDP is a text-based format describing multimedia sessions. In WebRTC, it contains:
- Codecs supported (VP8, VP9, H.264, Opus)
- Network parameters (ICE ufrag/pwd)
- DTLS fingerprint (for encryption)
- Bandwidth constraints

### WHY Does It Matter?
SDP is the "contract" between peers. If Peer A offers VP8 and Peer B only supports H.264, negotiation must find a common codec or the call fails.

### HOW Does It Look?
```
v=0
o=- 1234567890 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS stream1
m=audio 9 UDP/TLS/RTP/SAVPF 111
a=rtpmap:111 opus/48000/2
a=ice-ufrag:abc123
a=ice-pwd:def456
a=fingerprint:sha-256 AB:CD:EF:...
a=setup:actpass
```

### WRONG vs RIGHT

**WRONG** — Modifying SDP strings manually with regex:
```javascript
sdp = sdp.replace(/opus\/48000/, 'opus/48000/2');
```
SDP parsing is subtle. Regex changes can break the entire session.

**RIGHT** — Using the RTCSessionDescription API:
```javascript
const offer = await pc.createOffer();
// Let the browser handle SDP generation
await pc.setLocalDescription(offer);
```

---

## Concept: NAT Traversal

### WHAT Is It?
NAT (Network Address Translation) hides private IPs behind a public IP. WebRTC needs to discover the public-facing endpoints.

### WHY Is It Hard?
Different NAT types behave differently:

| NAT Type | STUN Works? | TURN Needed? | Prevalence |
|----------|-------------|--------------|------------|
| Full Cone | Yes | No | ~5% |
| Restricted Cone | Usually | Sometimes | ~30% |
| Port Restricted | Sometimes | Often | ~35% |
| Symmetric | No | Yes | ~30% |

Symmetric NAT is the killer: each outbound destination gets a different mapped port, so the STUN-discovered port is useless for inbound connections from the peer.

### WRONG vs RIGHT

**WRONG** — Assuming STUN is enough:
```javascript
// No TURN server configured
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});
```
15-20% of your users will fail to connect.

**RIGHT** — Always provide TURN fallback:
```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }
  ]
});
```

---

## Concept: SFU vs MCU vs Mesh

### WHAT Are They?
Three architectures for multi-party calls:

**Mesh**: Each peer sends media directly to every other peer.
**SFU**: Each peer sends 1 stream to a server; server selectively forwards.
**MCU**: Each peer sends 1 stream; server composites into 1 stream.

### WHY Choose One?

```
Mesh (N=4 peers):
  Peer A ──┬──► Peer B
           ├──► Peer C
           └──► Peer D
  Peer B uploads 3 streams, downloads 3 streams.
  Total server bandwidth: 0
  Total client upload: 3 × bitrate

SFU (N=4 peers):
  Peer A ──► Server ──┬──► Peer B
                      ├──► Peer C
                      └──► Peer D
  Peer A uploads 1 stream.
  Total server bandwidth: 12 × bitrate (forwarding)
  Total client upload: 1 × bitrate
```

### WRONG vs RIGHT

**WRONG** — Using Mesh for a 50-person webinar:
Each peer uploads 49 video streams. Impossible on consumer bandwidth.

**RIGHT** — Using SFU for large groups, Mesh for 1:1 or small calls:
| Peers | Architecture |
|-------|-------------|
| 2 | Mesh |
| 3-8 | Mesh or SFU |
| 9-50 | SFU |
| 50+ | MCU or SFU with simulcast |
