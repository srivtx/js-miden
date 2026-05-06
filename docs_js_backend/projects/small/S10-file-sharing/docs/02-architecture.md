# S10 File Sharing — Architecture

## Decision: Local Filesystem vs. S3 vs. MinIO

### Alternative 1: Local Filesystem (Current)
- **Pros**: Zero setup, fast local I/O, no network latency, works offline.
- **Cons**: Not horizontally scalable (two app servers see different disks), disk fills up, no built-in redundancy, hard to backup.
- **Verdict**: Perfect for development and single-node deployments.

### Alternative 2: AWS S3 (Object Storage)
- **Pros**: Infinitely scalable, 11 9's durability, global CDN integration (CloudFront), lifecycle policies, versioning.
- **Cons**: Requires AWS account, network latency, egress costs, complexity of IAM policies.
- **Verdict**: The production standard for file storage.

### Alternative 3: MinIO (Self-Hosted S3-Compatible)
- **Pros**: API-compatible with S3, runs on-premise or in Docker, no vendor lock-in, free.
- **Cons**: You operate the storage layer (disk failures, backups, scaling are your responsibility).
- **Verdict**: Excellent for private clouds, air-gapped environments, or cost-sensitive projects that still need S3 semantics.

**Storage abstraction** is key: if `storage.ts` implements an interface (`save`, `read`, `delete`), swapping local disk for S3 or MinIO requires only a new adapter.

## Decision: UUID Tokens vs. Signed URLs

### Alternative 1: UUID Token (Current)
- **Pros**: Opaque, unguessable, trivial to generate.
- **Cons**: Requires the application server to proxy every download (CPU and bandwidth bottleneck).
- **Verdict**: Fine for small files and low traffic.

### Alternative 2: Signed URLs (e.g., S3 Presigned URL)
```
https://bucket.s3.amazonaws.com/key?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=...
```
- **Pros**: Client downloads directly from S3; the application server is bypassed for the bytes, saving bandwidth and CPU.
- **Cons**: URL length is large, requires clock synchronization for signature expiry, URL leaks grant temporary access.
- **Verdict**: Essential for large files (video, images) and high-traffic systems.

### Alternative 3: JWT-Based Download Tokens
- **Pros**: Self-contained (claims include file ID, expiry, permissions), no database lookup needed to validate.
- **Cons**: Long URLs, cannot revoke without a blocklist, signature verification is CPU-intensive at scale.
- **Verdict**: Good for stateless microservices; less common for simple file sharing.

## Decision: Base64 Upload vs. Multipart Form Data vs. Direct-to-Storage

### Alternative 1: Base64 in JSON (Current)
- **Pros**: Simple to test with curl/Postman, single JSON payload.
- **Cons**: Base64 inflates size by ~33%, JSON parser must hold the entire file in memory, no streaming.
- **Verdict**: Acceptable for files under a few megabytes.

### Alternative 2: Multipart Form Data (`multipart/form-data`)
- **Pros**: Standard for browsers, supports streaming, no base64 overhead.
- **Cons**: Requires `multer` or `busboy` middleware, slightly more complex headers.
- **Verdict**: The correct choice for production file uploads.

### Alternative 3: Direct-to-S3 (Presigned POST)
- **Pros**: Client uploads directly to S3; application server never touches the bytes, eliminating bandwidth and memory limits.
- **Cons**: Complex CORS setup, client must handle S3 errors, harder to validate file content before storage.
- **Verdict**: Best for large files and mobile uploads where server bandwidth is expensive.
