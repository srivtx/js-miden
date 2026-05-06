# Stream Ingestion

## Overview
The Ingest Service manages stream lifecycle: creation, validation, and termination.

## Stream Lifecycle

```
Offline → Starting → Live → Ended
            │          │
            │          ├─→ Paused (brief disconnect)
            │          │
            │          └─→ Ended (explicit stop)
            │
            └─→ Failed (validation error)
```

## API Endpoints

### Start Stream
```
POST /streams/start
Content-Type: application/json

{
  "channelId": "channel123",
  "title": "Live Coding Session",
  "userId": "user456"
}

Response 201:
{
  "stream": {
    "streamKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "rtmpUrl": "rtmp://localhost:1935/live/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "live"
  }
}
```

### End Stream
```
POST /streams/:streamKey/end

Response 200:
{
  "stream": {
    "status": "ended",
    "endedAt": "2024-01-01T12:00:00Z"
  }
}
```

### Get Active Stream
```
GET /streams/:channelId

Response 200:
{
  "stream": {
    "streamKey": "...",
    "title": "Live Coding Session",
    "status": "live",
    "startedAt": "2024-01-01T10:00:00Z"
  }
}
```

### Validate Stream Key (RTMP Server)
```
GET /streams/validate/:streamKey

Response 200:
{
  "valid": true,
  "streamKey": "a1b2c3d4-..."
}
```

## Redis Events

| Event | Payload | Consumer |
|-------|---------|----------|
| `stream:start` | `{ streamKey, channelId, rtmpUrl }` | Transcode Service |
| `stream:end` | `{ streamKey }` | Transcode Service, Analytics |

## Authentication Requirements
- Stream start requires valid user session
- User must own the channel
- Stream key validation must verify key exists and is active

## Known Vulnerabilities
1. **No authentication**: `/streams/start` accepts requests without JWT validation
2. **No ownership check**: Any user can stream to any channel
3. **Fake validation**: `/streams/validate` always returns `valid: true`

See `07-security.md` for details.
