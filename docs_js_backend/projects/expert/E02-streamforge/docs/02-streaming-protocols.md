# Streaming Protocols

## RTMP Ingest

### Overview
Real-Time Messaging Protocol (RTMP) is used for stream ingestion from broadcasters.

### Stream Key Generation
```
POST /streams/start
{
  "channelId": "channel123",
  "title": "My Stream"
}

Response:
{
  "stream": {
    "streamKey": "uuid-v4-key",
    "rtmpUrl": "rtmp://localhost:1935/live/uuid-v4-key"
  }
}
```

### OBS Configuration
- **Server**: `rtmp://streamforge.example.com:1935/live`
- **Stream Key**: Your generated UUID

## HLS Delivery

### Overview
HTTP Live Streaming (HLS) is used for viewer playback with adaptive bitrate.

### Transcoding Pipeline
```
RTMP Input
    │
    ▼
┌─────────────┐
│ 1080p @ 5Mbps │ → 1080p/playlist.m3u8
├─────────────┤
│  720p @ 3Mbps │ → 720p/playlist.m3u8
├─────────────┤
│  480p @ 1.5Mbps│ → 480p/playlist.m3u8
├─────────────┤
│  360p @ 800Kbps│ → 360p/playlist.m3u8
└─────────────┘
         │
         ▼
   master.m3u8
```

### Master Playlist
```m3u8
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
```

### Latency
| Protocol | Typical Latency |
|----------|----------------|
| RTMP Ingest | 2-5 seconds |
| HLS Delivery | 10-30 seconds |
| WebRTC | < 1 second |

## CDN Integration
For production, HLS playlists and segments should be served via CDN:
- **CloudFront**: AWS CDN with origin shield
- **Cloudflare**: Integrated streaming features
- **Fastly**: Real-time purging for live streams

## Known Vulnerability
The ingest service does not validate stream tokens properly. See `07-security.md`.
