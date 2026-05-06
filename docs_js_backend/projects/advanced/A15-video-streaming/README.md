# A15 Video Streaming Backend

Advanced video streaming backend implementing HLS/DASH adaptive bitrate streaming, video upload pipeline, transcoding integration, CDN distribution, and watch history/recommendations.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│   Express    │────▶│  Upload Service │
│             │     │   Server     │     │  (Multer)       │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                     │                       │
       │ Range Requests      │ Stream Service        ▼
       ▼                     ▼              ┌─────────────────┐
┌─────────────┐     ┌──────────────┐       │  Transcode      │
│   CDN Edge  │◀────│  HLS/DASH    │◀──────│  Worker (FFmpeg)│
│   Cache     │     │  Manifests   │       └─────────────────┘
└─────────────┘     └──────────────┘
       ▲                     │
       │                     ▼
       │            ┌─────────────────┐
       └────────────│  Storage        │
                    │  (Video Files)  │
                    └─────────────────┘
```

## Features

- **HLS/DASH Streaming**: Adaptive bitrate manifests and segment serving
- **Video Upload**: Multipart upload with progress tracking
- **Transcoding Pipeline**: FFmpeg integration points for multi-bitrate generation
- **CDN Integration**: Origin shield and edge cache headers
- **Range Requests**: HTTP 206 Partial Content for seek support
- **Watch History**: User viewing tracking
- **Recommendations**: Collaborative filtering stub

## Tech Stack

- Express 5 (ESM)
- TypeScript
- Vitest + Supertest
- Multer (uploads)
- Winston (logging)

## Known Bugs

1. **Range Request Validation Missing**: The `parseRange` utility does not validate byte ranges against actual file size, allowing clients to request arbitrary ranges and causing excessive memory usage.

## Getting Started

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Docker

```bash
docker-compose up -d
```
