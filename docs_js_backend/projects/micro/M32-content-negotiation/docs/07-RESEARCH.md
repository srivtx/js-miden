# M32: Research & Citations

## RFCs
- RFC 7231 Section 5.3: Content Negotiation
- RFC 7231 Section 5.3.2: Accept header grammar

## npm Trends
- `negotiator`: 30M+ downloads/week (used by Express internally)
- `accepts`: 30M+ downloads/week (Express's req.accepts)
- `fastify-accepts`: Fastify ecosystem equivalent

## Benchmarks
- Manual parser (this project): ~500K parses/sec
- `negotiator` package: ~2M parses/sec (optimized C-like loop)

## Best Practices
- Default to JSON for APIs; HTML for browser routes
- Wildcard `*/*` should match the server's highest-quality available format
- Always set `Vary: Accept` header when content negotiation changes the response body
