# StreamForge - Architecture Overview

## System Overview
StreamForge is a live streaming platform backend supporting RTMP ingestion, multi-quality HLS transcoding, real-time chat, viewer analytics, and monetization.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Clients                                 │
│  (OBS, StreamLabs, Web Player, Mobile)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Ingest     │ │   HLS    │ │   WebSocket  │
│   Service    │ │  Player  │ │    Chat      │
│   (4000)     │ │          │ │   (4002)     │
└──────┬───────┘ └──────────┘ └──────┬───────┘
       │                              │
       │                              │
       ▼                              ▼
┌──────────────┐            ┌─────────────────┐
│  Transcode   │            │    Analytics    │
│   Service    │            │    Service      │
│   (4001)     │            │    (4003)       │
└──────┬───────┘            └────────┬────────┘
       │                             │
       │                             │
┌──────▼───────┐            ┌───────▼────────┐
│   Storage    │            │    MongoDB     │
│  (HLS Segs)  │            │   (Analytics)  │
└──────────────┘            └────────────────┘
                                     │
                              ┌──────▼───────┐
                              │    Redis     │
                              │ (Viewer cnt) │
                              └──────────────┘
```

## Service Responsibilities

### Ingest Service (Port 4000)
- Accepts stream start/end requests
- Generates stream keys and RTMP URLs
- Validates RTMP connections
- Publishes stream events to Redis

### Transcode Service (Port 4001)
- Listens for stream start events
- Transcodes RTMP to multiple quality HLS streams
- Generates master and quality playlists
- Serves HLS content via HTTP

### Chat Service (Port 4002)
- WebSocket server for real-time chat
- Channel-based message routing
- Redis pub/sub for horizontal scaling
- Chat history API

### Analytics Service (Port 4003)
- Viewer count tracking
- Donation processing
- Subscription management
- Stream analytics and reporting

## Technology Stack
- **Runtime**: Node.js 20, Express 5
- **Language**: TypeScript 5.3 (ESM)
- **Databases**: MongoDB 7, Redis 7
- **Streaming**: RTMP mock, HLS
- **Real-time**: WebSocket, Redis Pub/Sub
- **Testing**: Vitest, Supertest
