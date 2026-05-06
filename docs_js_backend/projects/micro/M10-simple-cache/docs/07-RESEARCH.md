# M10: Simple Cache — Latest Trends & Research

## Trend 1: Native Web Platform Caching (Cache API)

The Cache API, originally designed for Service Workers, is now available in some server-side runtimes (Deno, Cloudflare Workers).

**WHAT:** A Promise-based API for storing `Request`/`Response` pairs.
**WHY:** Standardizes caching across edge runtimes.
**Status:** Not available in Node.js core yet, but worth monitoring.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/Cache

## Trend 2: QuickLRU --- A Minimal LRU for Modern JS

`quick-lru` is a smaller alternative to `lru-cache` with a Map-based implementation.

**Comparison:**
- `lru-cache`: ~25KB, feature-rich, battle-tested.
- `quick-lru`: ~5KB, simpler, good for bundlers.

**Source:** https://github.com/sindresorhus/quick-lru

## Trend 3: Node.js `node:sqlite` and In-Memory Databases

With Node.js 22+ introducing a built-in SQLite module, some developers are using `:memory:` SQLite databases as structured caches.

**WHY:** SQL interface for cache queries, ACID transactions, built-in.
**Trade-off:** Higher overhead than a simple Map.

**Source:** https://nodejs.org/api/sqlite.html

## Trend 4: Edge Caching (Vercel, Cloudflare)

Modern deployments use edge networks that cache at the CDN level, bypassing the application server entirely.

**WHAT:** Cache-Control headers and Edge Config (Vercel), Cache API (Cloudflare).
**WHY:** Eliminates even the in-memory cache lookup latency.
**Impact:** For many web apps, in-memory caching is becoming a secondary layer after edge caching.

**Source:** https://vercel.com/docs/edge-network/caching

## Trend 5: Observable Caches and Signals

Frameworks like SolidJS and Preact Signals introduce reactive caches where consumers automatically re-render when cached data changes.

**WHAT:** `createResource` in SolidJS wraps fetch calls with a reactive cache.
**Relevance:** While frontend-focused, the pattern of "signal-based invalidation" is influencing backend reactive systems.

**Source:** https://www.solidjs.com/tutorial/async_resources

## WRONG vs RIGHT

**WRONG:** Building a custom LRU implementation in 2024 for a production app.
**RIGHT:** Using `lru-cache` or `quick-lru`, and augmenting with edge caching where possible.

## Sources
- Cache API MDN: https://developer.mozilla.org/en-US/docs/Web/API/Cache
- quick-lru GitHub: https://github.com/sindresorhus/quick-lru
- Vercel Edge Caching: https://vercel.com/docs/edge-network/caching
