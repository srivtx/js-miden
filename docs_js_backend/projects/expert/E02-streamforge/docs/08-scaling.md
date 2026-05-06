# Scaling & Performance

## Scaling Requirements

### Concurrent Streams
| Metric | Target | Strategy |
|--------|--------|----------|
| Active streams | 10,000+ | Horizontal ingest scaling |
| Viewers per stream | 100,000+ | CDN + edge caching |
| Chat messages/sec | 10,000+ | Redis pub/sub sharding |

## Service Scaling

### Ingest Service
- Stateless - scale horizontally
- RTMP load balancer required
- Stream keys cached in Redis

### Transcode Service
- CPU-intensive - scale based on queue depth
- Use GPU instances for FFmpeg
- Queue transcoding jobs with BullMQ

### Chat Service
- WebSocket connections = memory bound
- Horizontal scaling with Redis sync
- Shard by channel ID for very large channels

### Analytics Service
- Write-heavy - use Redis for real-time counters
- Batch MongoDB writes
- Read replicas for analytics queries

## CDN Strategy
```
Viewer Request
    │
    ▼
CDN Edge (CloudFront/Cloudflare)
    │
    ├── Cache Hit ──► Serve HLS segment
    │
    └── Cache Miss ──► Origin (Transcode Service)
                           │
                           └── Serve + Cache
```

## Latency Optimization
| Component | Target | Technique |
|-----------|--------|-----------|
| RTMP ingest | < 3s | Dedicated ingest nodes |
| HLS segment | < 6s | 2-second segments |
| Chat delivery | < 100ms | WebSocket + Redis |
| Viewer count | < 500ms | Redis INCR |

## Database Optimization
- MongoDB compound indexes on `{ channelId, createdAt }`
- Redis TTL on viewer sessions
- Analytics aggregation pipeline
