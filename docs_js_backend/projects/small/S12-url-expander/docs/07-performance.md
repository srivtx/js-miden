# S12 URL Expander — Performance

## HTTP Hop Latency

Each redirect adds round-trip time (RTT):
- 1 hop: ~50–200 ms
- 5 hops: ~250–1000 ms
- 10 hops: ~500–2000 ms

For a synchronous API, the total latency is the sum of all hops. Consider async processing with a callback or webhook for slow chains.

## HEAD vs GET Bandwidth

Using HEAD first avoids downloading response bodies:
- **HEAD**: ~200 bytes headers only.
- **GET**: Potentially megabytes if the final URL is a large file.

**Savings**: Up to 99.9% bandwidth reduction for large final destinations.

## Timeout Impact on Throughput

A 5-second timeout per hop means:
- Best case: 1 hop × 50 ms = 50 ms per request.
- Worst case: 10 hops × 5 s = 50 s per request (then fails).

With a single-threaded Node.js event loop, 10 concurrent slow requests can delay all other requests. Use a worker pool or queue for expansion tasks.

## Caching

Repeated expansions of the same short URL should be cached:
```typescript
const cached = await redis.get(`expand:${url}`);
if (cached) return JSON.parse(cached);
```

**TTL**: Short URLs rarely change their final destination. A 1-hour TTL is reasonable.

## Connection Reuse

The current implementation opens a new TCP connection per hop. HTTP keep-alive would reduce handshake overhead:
```typescript
const agent = new http.Agent({ keepAlive: true });
```
