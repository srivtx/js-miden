# StreamForge - Live Streaming Backend

Production-grade live streaming platform backend with RTMP ingestion, multi-quality HLS transcoding, real-time chat, and monetization.

## Architecture

```
                    ┌──────────────┐
                    │   Clients    │
                    │ (OBS, Web)   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Ingest  │  │  HLS    │  │  Chat   │
        │ (4000)  │  │ Player  │  │ (4002)  │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             │            │            │
             ▼            │            ▼
        ┌─────────┐       │       ┌─────────┐
        │Transcode│       │       │Analytics│
        │ (4001)  │       │       │ (4003)  │
        └────┬────┘       │       └────┬────┘
             │            │            │
             │            │            │
        ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
        │ Storage │  │  Redis  │  │ MongoDB │
        │ (HLS)   │  │(Pub/Sub)│  │(Metrics)│
        └─────────┘  └─────────┘  └─────────┘
```

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| Ingest | 4000 | RTMP stream ingestion, stream keys |
| Transcode | 4001 | HLS transcoding, playlist serving |
| Chat | 4002 | WebSocket real-time chat |
| Analytics | 4003 | Viewer counts, donations, subscriptions |

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your secrets

# Start with Docker Compose
docker-compose up -d

# Or run individually
npm run dev:ingest
npm run dev:transcode
npm run dev:chat
npm run dev:analytics
```

## API Examples

### Start Stream
```bash
curl -X POST http://localhost:4000/streams/start \
  -H "Content-Type: application/json" \
  -d '{"channelId":"channel123","title":"My Stream"}'
```

### Get Playlist
```bash
curl http://localhost:4001/playlist/channel123/stream456
```

### Connect to Chat
```javascript
const ws = new WebSocket('ws://localhost:4002/ws?channel=channel123');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ username: 'viewer1', message: 'Hello!' }));
```

### Join Stream (Analytics)
```bash
curl -X POST http://localhost:4003/viewers/join \
  -H "Content-Type: application/json" \
  -d '{"channelId":"channel123","streamKey":"stream456","viewerId":"viewer789"}'
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Documentation

- [Architecture](docs/01-architecture.md)
- [Streaming Protocols](docs/02-streaming-protocols.md)
- [Ingestion](docs/03-ingestion.md)
- [Transcoding](docs/04-transcoding.md)
- [Chat](docs/05-chat.md)
- [Analytics & Monetization](docs/06-analytics.md)
- [Security Audit](docs/07-security.md)
- [Scaling & Performance](docs/08-scaling.md)
- [Deployment](docs/09-deployment.md)

## Known Bugs (Intentional)

This project contains intentional bugs for training purposes:

1. **Unauthenticated streaming**: Anyone can start streams without authentication
2. **Fake token validation**: RTMP validation always returns valid
3. **Chat not persisted**: Messages are lost on reconnect
4. **Viewer count race condition**: Concurrent joins/leaves produce inaccurate counts

See `docs/07-security.md` for details and fixes.

## License
MIT
