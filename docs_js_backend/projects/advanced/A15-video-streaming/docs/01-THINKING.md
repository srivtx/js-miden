# Thinking Process

## Initial Thoughts

Video streaming is fundamentally about efficiently delivering large binary files over HTTP. The two dominant protocols are HLS (HTTP Live Streaming) and DASH (Dynamic Adaptive Streaming over HTTP). Both work by breaking a video into small segments (typically 2-10 seconds) and serving them via standard HTTP requests.

## Architecture Considerations

1. **Storage**: Raw uploads and transcoded variants need organized storage. A structure like `/videos/{videoId}/{variant}/segments/` works well.
2. **Transcoding**: CPU-intensive. Should be offloaded to worker processes or services. We stub this with integration points.
3. **Streaming**: For MP4 files, range requests allow seeking. For HLS/DASH, the client downloads a manifest file listing segments, then fetches segments as needed.
4. **CDN**: Caches segments at edge locations. We must set long cache headers for immutable segments and short/no-cache for manifests.
5. **Uploads**: Use Multer for multipart handling. For large files, consider chunked/resumable uploads (stubbed here).

## Range Request Dilemma

Range requests are critical for video players. However, parsing the `Range: bytes=start-end` header requires:
- Validating start <= end
- Ensuring both are within file bounds
- Limiting maximum chunk size to prevent memory exhaustion

Our initial implementation skipped these validations for simplicity, creating a security hole.

## Scaling Thoughts

- Use Redis for upload session state and rate limiting.
- Use a message queue (Redis/RabbitMQ) for transcoding jobs.
- Use PostgreSQL for video metadata and watch history.
