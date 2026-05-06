# Setup Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## Installation

```bash
# Navigate to project
cd docs_js_backend/projects/advanced/A08-webrtc-signaling

# Install dependencies
npm install

# Start services
docker-compose up -d

# Run in development mode
npm run dev
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| WS_PORT | 3001 | WebSocket port (if separate) |
| NODE_ENV | development | Environment mode |
| REDIS_URL | redis://localhost:6379 | Redis connection |

### TURN Server

The included `docker-compose.yml` starts a coturn server for NAT traversal:

```yaml
turn:
  image: coturn/coturn:latest
  ports:
    - "3478:3478"
    - "10000-10100:10000-10100/udp"
```

Credentials: `user:pass` (realm: `webrtc.local`)

## Client Integration

### Browser WebRTC Setup

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:localhost:3478', username: 'user', credential: 'pass' }
  ]
});

const ws = new WebSocket('ws://localhost:3000?peerId=peer-1');

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'offer') {
    await pc.setRemoteDescription(msg.payload);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({
      type: 'answer',
      roomId: 'room-1',
      targetPeerId: msg.peerId,
      payload: answer
    }));
  }
};
```

## Verification

```bash
# Check health
curl http://localhost:3000/api/health

# Run tests
npm test
```

## References

[1] WebRTC Getting Started, Google Developers. https://webrtc.org/getting-started/
[2] Coturn Setup Guide. https://github.com/coturn/coturn/wiki/turnserver