# Transcoding & HLS

## Overview
The Transcode Service converts incoming RTMP streams to HTTP Live Streaming (HLS) format with multiple quality levels.

## Transcoding Pipeline

```
RTMP Input Stream
       │
       ▼
┌──────────────┐
│ Demux Audio  │
│ & Video      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Decode to    │
│ Raw Frames   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Scale &      │────►│ 1080p Encode │────► 1080p/playlist.m3u8
│ Encode 1080p │     │ 5 Mbps H.264 │
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Scale &      │────►│  720p Encode │────► 720p/playlist.m3u8
│ Encode 720p  │     │ 3 Mbps H.264 │
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Scale &      │────►│  480p Encode │────► 480p/playlist.m3u8
│ Encode 480p  │     │ 1.5 Mbps H.264│
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Scale &      │────►│  360p Encode │────► 360p/playlist.m3u8
│ Encode 360p  │     │ 800 Kbps H.264│
└──────────────┘     └──────────────┘
```

## Quality Ladder

| Quality | Resolution | Bitrate | Segment Duration |
|---------|-----------|---------|------------------|
| 1080p | 1920x1080 | 5 Mbps | 6 seconds |
| 720p | 1280x720 | 3 Mbps | 6 seconds |
| 480p | 854x480 | 1.5 Mbps | 6 seconds |
| 360p | 640x360 | 800 Kbps | 6 seconds |

## File Structure
```
streams/
└── {channelId}/
    └── {streamKey}/
        ├── master.m3u8
        ├── 1080p/
        │   ├── playlist.m3u8
        │   ├── segment_0.ts
        │   └── segment_1.ts
        ├── 720p/
        │   ├── playlist.m3u8
        │   ├── segment_0.ts
        │   └── segment_1.ts
        └── ...
```

## API Endpoints

### Get Master Playlist
```
GET /playlist/:channelId/:streamKey
Content-Type: application/vnd.apple.mpegurl
```

### Get Segment (via static serve)
```
GET /streams/:channelId/:streamKey/:quality/segment_N.ts
```

## Production Considerations
- Use FFmpeg for actual transcoding
- Consider GPU acceleration (NVENC, QuickSync)
- Implement adaptive segment duration
- Add DRM for premium content
