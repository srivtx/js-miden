# S13 API Key Manager — Performance

## Hashing Speed

| Algorithm | Time per Hash | Use Case |
|-----------|--------------|----------|
| SHA-256 | ~1 μs | API key hashing |
| bcrypt (10 rounds) | ~100 ms | Password hashing |
| Argon2id | ~200 ms | Password hashing |

For an API serving 10,000 requests/second:
- **SHA-256**: 10 ms total hashing time (negligible).
- **bcrypt**: 1,000 seconds total → impossible.

**Conclusion**: SHA-256 is the correct choice for high-entropy API keys.

## Database Lookup

With an index on `key_hash`, SQLite lookup is O(log n) and completes in <1 ms for tables with millions of rows.

## Rate Limiting Overhead

The in-memory Map lookup is O(1) and completes in <1 μs. Redis adds ~1 ms network round-trip.

## Key Generation

`crypto.randomBytes(32)` generates 256 bits of entropy using the OS CSPRNG (`/dev/urandom` on Linux, `CryptGenRandom` on Windows). It is non-blocking and completes in <1 ms.

## Connection Pooling

If using PostgreSQL/MySQL in production, maintain a connection pool to avoid connection setup overhead per request. SQLite is file-based and does not require pooling.
