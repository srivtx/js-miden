# 02-DECISIONS

## Multer vs Busboy
- **Multer**: Higher-level, integrates with Express, handles disk/memory storage automatically.
- **Busboy**: Streaming, lower-level, less memory but more boilerplate.
- **Decision**: Multer for curriculum clarity; in production high-scale systems may prefer Busboy with streaming S3 uploads.

## Local vs S3 Storage
- **Local**: Simple, fast for small apps, hard to scale horizontally.
- **S3**: Durable, CDN-friendly, but adds latency and complexity.
- **Decision**: Storage interface abstracts both; local default, S3 via env toggle.

## Sharp vs Jimp
- **Sharp**: Native bindings, fast, battle-tested, large feature set.
- **Jimp**: Pure JS, slower, no native dependencies.
- **Decision**: Sharp. Image processing is CPU-bound; native performance matters.

## Sync vs Async Virus Scan
- **Sync**: Blocks the request until scan completes; simpler but slower.
- **Async**: Accept file, enqueue scan, return token; complex but fast.
- **Decision**: Sync stub for simplicity; real integration should be async or use a streaming scanner.
