# Core Concepts

## HLS (HTTP Live Streaming)

Developed by Apple, HLS works by:
1. Encoding video into multiple bitrates.
2. Splitting each bitrate into short segments (~6 seconds).
3. Creating a playlist (`.m3u8` manifest) listing segments.
4. Client downloads master manifest, selects appropriate variant based on bandwidth, then downloads segment files.

```
Master Playlist
├── Variant 1080p (playlist.m3u8)
│   ├── segment_0.ts
│   ├── segment_1.ts
│   └── ...
├── Variant 720p (playlist.m3u8)
│   ├── segment_0.ts
│   └── ...
```

## DASH (Dynamic Adaptive Streaming over HTTP)

MPEG standard using an XML-based Media Presentation Description (`.mpd`). Similar to HLS but:
- Single manifest file with SegmentTemplate or SegmentList
- Supports more codecs and DRM standards
- Uses `.m4s` segments (ISO BMFF format)

## Adaptive Bitrate (ABR)

The player monitors download speed and buffer health. If bandwidth drops, it switches to a lower bitrate variant seamlessly. This requires:
- Multiple pre-encoded variants
- Segment alignment across variants
- Bandwidth estimation in the player

## HTTP Range Requests

`Range: bytes=start-end` allows requesting a portion of a file. Servers respond with `206 Partial Content` and `Content-Range` header. Critical for:
- Video seeking without downloading entire file
- Resuming interrupted downloads
- Efficient scrubbing in players

## CDN Caching Strategy

- **Manifests**: Cache-Control: max-age=2 (frequently updated during live)
- **Segments**: Cache-Control: max-age=31536000, immutable (never change)
- **Origin Shield**: Reduce origin hits when multiple edges request same content
