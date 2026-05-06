# S04 Image Resizer — Decision Log

## Decision: Buffer vs Stream Processing

| Approach | Memory | Speed | Code Complexity | Best For |
|----------|--------|-------|-----------------|----------|
| Buffer (`readFile` + `sharp(buffer)`) | O(n) — entire file | Fast (single allocation) | Low | Small files (<5 MB), prototyping |
| Stream (`createReadStream` + `sharp()`) | O(1) — constant | Slightly slower (chunk overhead) | Medium | Large files, production |
| File (`sharp(path).toFile`) | O(1) | Fastest (libvips native file I/O) | Low | When input is already on disk |

We currently use **buffers** (see `05-security.md` for the bug). In production, use streaming or direct file paths:
```ts
const out = await sharp(filePath).resize(200).toBuffer();
```

Even better: `sharp(filePath)` lets libvips memory-map the file, avoiding Node.js buffer copies entirely.

## Decision: Disk Storage vs Memory Storage (Multer)

| Approach | Max File Size | Persistence | Risk |
|----------|---------------|-------------|------|
| `multer.memoryStorage()` | RAM limited | None | OOM at scale |
| `multer.diskStorage()` | Disk limited | Until deleted | Disk exhaustion |
| S3 direct upload | Unlimited | Permanent | Requires signed URLs |

We chose disk storage because:
1. It avoids memory pressure from large uploads.
2. It allows Sharp to read directly from disk.
3. Local disk is sufficient for a demo; production uses S3.

## Decision: On-Demand vs Pre-Generated Resizes

| Approach | Storage Cost | CPU Cost | Latency | Flexibility |
|----------|--------------|----------|---------|-------------|
| On-demand (this project) | Low | High (per request) | High (first hit) | Unlimited sizes |
| Pre-generated | High (N sizes per image) | Low (once) | Low | Fixed sizes |
| Hybrid (generate + cache) | Medium | Medium | Low after first hit | Unlimited |

On-demand is simplest to implement but dangerous under load. A better production pattern:
1. Accept upload.
2. Generate 3-5 standard sizes (thumbnail, medium, large).
3. Store in S3 + CloudFront.
4. On-demand resize only for non-standard sizes, and cache the result.

## Decision: Sharp vs Jimp vs ImageMagick

| Library | Speed | Features | Native Dependencies | Best For |
|---------|-------|----------|---------------------|----------|
| Sharp | Fastest | Modern formats, streaming | libvips (prebuilt) | Production |
| Jimp | Slow | Basic ops | None (pure JS) | Prototypes, constrained envs |
| ImageMagick (gm) | Moderate | Extremely broad | Heavy system install | Legacy compatibility |
| Canvas (skia) | Moderate | Drawing + images | Native | Compositing text/graphics |

**Sharp benchmarks** (resize 4000×3000 JPEG to 800×600):
- Sharp: ~45 ms
- Jimp: ~1,200 ms
- ImageMagick: ~180 ms

We chose Sharp for its **25× speed advantage** over Jimp and prebuilt binaries that do not require system package managers.

## Decision: Local Filesystem vs S3

| Approach | Durability | Scalability | Cost | Complexity |
|----------|------------|-------------|------|------------|
| Local disk | None (single node) | None | Free | Trivial |
| S3 + CloudFront | 99.999999999% | Infinite | $0.023/GB | Medium |
| Cloudflare R2 | 99.999999999% | Infinite | ~$0.015/GB | Medium |

Local disk is acceptable for demos but must be replaced with object storage for any multi-instance deployment. Ephemeral disks on container platforms (ECS, Kubernetes) lose data on restart.

## Decision: Trust Browser MIME Type

**This is a security bug.** The correct approach is:
1. Reject uploads > `multer` file size limit.
2. After upload, read magic bytes to verify format.
3. If magic bytes mismatch extension/MIME, delete file and return 400.

See `05-security.md` for exploitation details.
