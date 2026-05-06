# M33: Design Decisions

## Option A: Use `crypto.randomUUID()` for v4, custom implementation for v7/ULID
- **Pros**: v4 is native and fast; v7/ULID are small enough to implement
- **Cons**: v7 timestamp bug risk (as in this project), not cryptographically audited
- **Chosen**: Yes, for curriculum transparency

## Option B: Use `uuid` npm package
- **Pros**: RFC-compliant, battle-tested, supports v1-v7
- **Cons**: Adds dependency, less educational for internal structure
- **Chosen**: No, but strongly recommended for production

## Option C: Use `ulidx` for ULID
- **Pros**: Correct base32 encoding, monotonic sort order
- **Cons**: Extra dependency
- **Chosen**: No

## Decision
Implement from scratch to teach bit structure and timestamp precision. The bug (seconds vs milliseconds) is a realistic mistake when reading the spec too quickly.
