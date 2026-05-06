# Problem Statement

Build a video streaming backend capable of serving HLS and DASH adaptive bitrate streams, handling large file uploads, transcoding to multiple qualities, integrating with a CDN, tracking watch history, and providing recommendations.

## Requirements

1. **Adaptive Streaming**: Support HLS (Apple) and DASH (MPEG-DASH) protocols with multiple quality variants (1080p, 720p, 480p, 360p).
2. **Video Upload**: Accept large video files via multipart upload with resumable support.
3. **Transcoding Pipeline**: Integrate with FFmpeg to generate multi-bitrate variants and segment files.
4. **CDN Integration**: Set proper cache headers and support origin shield invalidation.
5. **Range Requests**: Support HTTP 206 Partial Content for seek/scrub operations.
6. **Watch History**: Record user viewing progress.
7. **Recommendations**: Stub for ML-based recommendation engine.

## Constraints

- Must handle files up to 10GB.
- Must support thousands of concurrent streams.
- Must minimize origin server load via CDN and caching.

## Known Issue

The range request parser lacks validation, allowing clients to request arbitrary byte ranges. This can cause excessive memory usage and potential denial-of-service.
