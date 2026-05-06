# M33: Research & Citations

## RFCs
- RFC 4122: UUID specification (v1-v5)
- Draft-peabody-dispatch-new-uuid-format-04: UUID v7 specification

## npm Trends
- `uuid`: 200M+ downloads/week
- `ulid`: 1M+ downloads/week
- `uuidv7`: 500K+ downloads/week (dedicated v7 implementations)

## Benchmarks
- `crypto.randomUUID()`: ~1M ops/sec
- Custom v7 (this project, fixed): ~600K ops/sec
- `ulidx` (optimized): ~800K ops/sec

## Best Practices
- Use UUID v7 for database primary keys (time-sortable, random suffix prevents hotspotting)
- Use UUID v4 for session tokens and secrets
- ULID is excellent for URL-safe identifiers but less standard than UUID
- Never use UUID v1 in public-facing systems (MAC address leakage)
