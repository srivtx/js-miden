# Setup Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## Installation

```bash
cd docs_js_backend/projects/expert/E03-datasync
npm install
docker-compose up -d
npm run dev
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| WS_PORT | 3001 | WebSocket port |
| STORAGE_TYPE | postgres | Storage backend |
| DATABASE_URL | | PostgreSQL connection string |
| REDIS_URL | | Redis connection string |

### Docker Compose

The included `docker-compose.yml` sets up:
- Sync service (port 3000)
- Presence service (port 3002)
- Storage service (port 3003)
- Conflict resolution service (port 3004)
- PostgreSQL (port 5432)
- Redis (port 6379)

## Client Integration

### JavaScript Client

```javascript
const ws = new WebSocket('ws://localhost:3000?peerId=peer-1');

ws.onopen = () => {
  // Request full sync
  ws.send(JSON.stringify({
    type: 'sync',
    peerId: 'peer-1',
    vectorClock: {}
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'sync') {
    // Apply documents to local state
    msg.documents.forEach(doc => applyDocument(doc));
  }
};

// Send local changes
function sendChange(docId, path, value) {
  ws.send(JSON.stringify({
    type: 'delta',
    peerId: 'peer-1',
    delta: [{
      type: 'set',
      documentId: docId,
      path: path,
      value: value,
      vectorClock: getLocalClock()
    }]
  }));
}
```

## Verification

```bash
# Run tests
npm test

# Check health
curl http://localhost:3000/api/health

# List documents
curl http://localhost:3000/api/documents
```

## References

[1] "Building a Real-Time Collaboration App," Socket.io Documentation.
[2] "Automerge JavaScript API." https://automerge.org/docs/