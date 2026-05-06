# Old Ways vs New Ways (2015 vs 2025)

## Pattern 1: Real-Time Communication

### The Old Way (2010-2015)
```javascript
// Flash / RTMP
var conn = new RTMPConnection('rtmp://server.example.com/live');
conn.publish('stream1');
```
**Why we did it:** Flash had ubiquitous browser support (95%+). RTMP was low-latency.
**Why it's wrong now:** Flash is dead (EOL 2020). Required a plugin. Server-dependent — all media flowed through Adobe Media Server. No P2P. No encryption by default.

### The New Way (2025)
```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }
  ]
});
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
ws.send(JSON.stringify({ type: 'offer', payload: offer }));
```
**Why it's better:** Native browser API, no plugins. P2P media path — server bandwidth cost near zero. DTLS-SRTP encryption mandatory. Works on mobile browsers.

### Migration Path
1. Replace Flash video capture with `getUserMedia()`
2. Replace RTMP server with WebSocket signaling + TURN relay
3. Implement ICE candidate gathering and relay
4. Add fallback to SFU for large groups (Mesh doesn't scale)

---

## Pattern 2: Signaling Transport

### The Old Way
HTTP long-polling for signaling:
```javascript
// Client polls every 2 seconds for new messages
setInterval(async () => {
  const msgs = await fetch('/poll?peerId=123');
  msgs.forEach(handleMessage);
}, 2000);
```
**Why it's wrong:** 500ms average latency for message delivery. High CPU/battery drain. Terrible for mobile.

### The New Way
WebSocket persistent connection:
```javascript
const ws = new WebSocket('wss://signal.example.com?peerId=123');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'offer') handleOffer(msg);
};
```
**Why it's better:** < 10ms message delivery. Single TCP connection. Native reconnection handling. Binary frame support.

---

## Pattern 3: Media Architecture

### The Old Way
Centralized media server (RTMP, HLS):
```
Browser ──► Media Server ──► CDN ──► Viewers
```
**Why it's wrong:** High server cost. High latency (3-10 seconds for HLS). No interactivity.

### The New Way
P2P with selective SFU fallback:
```
1:1 calls:    Browser A ◄────P2P────► Browser B
Small group:  Browser A ◄──Mesh──► Browser B,C,D
Large group:  Browser A ──► SFU ──► Browser B,C,D...
```
**Why it's better:** Offloads bandwidth to clients. Sub-second latency. Interactive.

---

## Pattern 4: NAT Traversal

### The Old Way
Manual port forwarding:
```
User configures router: "Forward port 5000 to 192.168.1.5"
```
**Why it's wrong:** Impossible for non-technical users. Doesn't work on mobile networks. Security risk.

### The New Way
ICE with STUN/TURN:
```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }
  ]
});
```
**Why it's better:** Fully automatic. Works for 99%+ of users. TURN fallback guarantees connectivity.

---

## Pattern 5: Encryption

### The Old Way
No encryption (RTMP) or server-terminated TLS (HLS):
```
Browser ──RTMP plaintext──► Media Server
```
**Why it's wrong:** Eavesdropping trivial. Server sees unencrypted media.

### The New Way
End-to-end DTLS-SRTP:
```
Browser A ──DTLS handshake──► Browser B
DTLS keys derived from SDP fingerprint exchange
SRTP encrypts every media packet with AES
```
**Why it's better:** Server cannot decrypt media. Even the signaling server only sees metadata. True E2EE for 1:1 calls.
