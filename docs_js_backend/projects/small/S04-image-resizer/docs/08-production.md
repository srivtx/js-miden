# S04 Image Resizer — Production Guide

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `UPLOAD_DIR` | `./uploads` | Local storage path |
| `MAX_FILE_SIZE_MB` | `10` | Upload limit |
| `MAX_DIMENSION` | `4096` | Resize ceiling |
| `SHARP_CONCURRENCY` | `2` | libvips threads per process |

## Docker

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y libvips-tools
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Why `libvips-tools`?** Sharp ships prebuilt binaries for common platforms, but Alpine or custom builds may need system libvips.

## Kubernetes Resource Limits

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "2000m"
```

**Critical**: Set memory limits >= 2× your largest expected image decode. A 50 MP image decodes to ~200 MB; limit should be 1 GB to handle 4-5 concurrent resizes safely.

## CDN + S3 Architecture

```
Client → CloudFront → S3 (cached resize)
            ↓ miss
        App → Sharp → S3 → CloudFront
```

1. Upload original to S3.
2. Lambda or app resizes on first request.
3. Store resized variant in S3 with `Cache-Control: max-age=31536000, immutable`.
4. CloudFront caches forever; subsequent requests never hit the app.

## Monitoring

| Metric | Tool | Alert |
|--------|------|-------|
| Resize duration p99 | Prometheus/Histogram | >500 ms |
| OOM kills | Kubernetes events | Any |
| Disk usage | Node exporter | >85% |
| 5xx rate | App logs | >0.1% |

## Scaling Strategy

Image resizing is **CPU-bound**, not I/O-bound. Horizontal scaling helps only if:
1. You cache aggressively (CDN or Redis).
2. You use a queue (SQS/Bull) to offload processing from the web server.
3. You pre-generate variants instead of on-demand.

**Recommended**: Use a job queue. The upload endpoint enqueues a resize job; the client polls or uses WebSockets for completion.

## Content Security

- Serve uploads from a separate domain (`static.example.com`) with no cookies, no JS execution, and `Content-Disposition: attachment`.
- Add `X-Content-Type-Options: nosniff` so browsers do not MIME-sniff polyglot files.
- Scan uploads with ClamAV or a cloud malware scanner if user-generated content is public.
