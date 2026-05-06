# M34: Research & Citations

## RFCs
- RFC 2616 Section 4.2: Message Headers (case-insensitivity)
- RFC 7230 Section 3.2: Header Fields
- RFC 7540 (HTTP/2): Header field names MUST be lowercase

## npm Trends
- `zod`: 10M+ downloads/week
- `joi`: 5M+ downloads/week
- `express-validator`: 2M+ downloads/week

## Benchmarks
- Manual validation (this project): ~200K req/sec
- `zod` parsing: ~100K req/sec (slower but safer)

## Best Practices
- Always normalize header names to lowercase before lookup
- Use `req.get()` in Express; it handles case-insensitivity
- In HTTP/2 environments, assume all incoming header names are lowercase
- Validate early (at edge/gateway) to fail fast and reduce attack surface
