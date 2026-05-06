# Research Notes

## Sources

- **RFC 4122 — A Universally Unique IDentifier (UUID) URN Namespace**
  - Key finding: Defines UUID versions, variants, and bit layouts. UUID v4 uses 122 random bits with version=4 and variant=10xx.
  - https://tools.ietf.org/html/rfc4122

- **Node.js Documentation — crypto.randomUUID()**
  - Key finding: Generates a RFC 4122 v4 UUID using a cryptographically secure pseudo-random number generator. Available since Node.js 14.17.0.
  - https://nodejs.org/api/crypto.html#cryptorandomuuidoptions

- **OWASP Cryptographic Storage Cheat Sheet**
  - Key finding: Use a cryptographically secure pseudo-random number generator (CSPRNG) for all random values used in security contexts. `Math.random()` is NOT a CSPRNG.
  - https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

- **Wikipedia — Birthday Problem**
  - Key finding: For UUID v4 (122 bits), the 50% collision probability occurs at ~2.71 × 10^18 values.
  - https://en.wikipedia.org/wiki/Birthday_problem

- **IETF Draft — UUID Version 7**
  - Key finding: UUID v7 is a new draft that uses a Unix timestamp prefix, making UUIDs sortable by time. It may replace v4 in some applications.
  - https://datatracker.ietf.org/doc/html/draft-peabody-dispatch-new-uuid-format

## Latest Trends (2025)

- **UUID v7 Adoption:** UUID v7 (sortable, time-based) is gaining traction for database primary keys because it reduces index fragmentation compared to random v4 UUIDs.
- **ULID:** An alternative to UUID v7 that is URL-safe and lexicographically sortable.
- **NanoID:** A smaller (21 chars), faster alternative to UUID v4 with a similar collision probability.
- **Snowflake IDs:** Twitter's distributed ID generation scheme is still widely used for high-throughput systems.

## Benchmarks

- `crypto.randomUUID()`: ~1 microsecond per call.
- `Math.random()` UUID generation: ~0.1 microseconds per call (but NOT secure).
- `uuid` npm package v4: ~1.5 microseconds per call.
- UUID validation regex: ~0.001 microseconds per call.

## Industry Adoption

- **MongoDB:** Uses UUID v4 for document IDs (optionally).
- **PostgreSQL:** Has a native `uuid` type. `gen_random_uuid()` uses a CSPRNG.
- **Stripe:** Uses UUID-like identifiers but with custom prefixes (e.g., `pi_1234...` for payment intents).
- **AWS:** EC2 instance IDs use a custom format, but many AWS services use UUIDs internally.
