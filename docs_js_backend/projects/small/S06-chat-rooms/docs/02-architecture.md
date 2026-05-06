# S06 Chat Rooms — Architecture

## Decision: Socket.io over Raw WebSockets

Socket.io was chosen as the primary real-time transport. Below are the alternatives considered.

### Alternative 1: Native WebSocket (`ws` library)
- **Pros**: Minimal overhead, direct RFC 6455 compliance, no proprietary protocol, smallest bundle size.
- **Cons**: No built-in reconnection, no room/broadcast abstractions, no fallback for restrictive proxies, must manually handle heartbeat/ping-pong and binary framing.
- **Verdict**: Excellent for high-throughput gaming or financial tickers where control is paramount; too low-level for a rapid-prototype chat room.

### Alternative 2: Server-Sent Events (SSE)
- **Pros**: Native browser API (`EventSource`), works over standard HTTP, automatic reconnection, simple one-way server→client push.
- **Cons**: No native client→server push (requires a second HTTP POST channel), limited to ~6 concurrent connections per browser tab due to HTTP/1.1 connection limits, no built-in binary support.
- **Verdict**: Great for live dashboards or news feeds; awkward for chat because every message send needs a separate POST.

### Alternative 3: Long Polling (AJAX polling)
- **Pros**: Works on every browser and network, no special server requirements, trivial to debug with curl.
- **Cons**: High latency (client waits for server or a timeout), massive HTTP header overhead, server must hold many open connections, battery drain on mobile.
- **Verdict**: Obsolete for real-time chat; only viable as a transparent fallback inside Socket.io.

### Selected Approach: Socket.io
Socket.io combines WebSocket transport with automatic fallbacks (long-polling → WebSocket), provides room namespaces, broadcast operators, and built-in reconnection. The trade-off is a larger client bundle and a non-standard protocol requiring the Socket.io client.

## Decision: In-Memory Room Registry vs. Redis Adapter

### Alternative 1: In-Memory Map (`Map<string, Set<string>>`)
- **Pros**: Zero infrastructure, sub-microsecond lookups, simplest implementation.
- **Cons**: Lost on process restart, cannot scale horizontally (two Node.js processes cannot share rooms), memory leak risk if `disconnect` cleanup fails.
- **Verdict**: Correct for a single-process educational app; unacceptable for production.

### Alternative 2: Redis Adapter (e.g., `socket.io-redis`)
- **Pros**: Rooms and presence synced across multiple server nodes; pub/sub scales to millions of sockets.
- **Cons**: Adds Redis as a dependency, introduces network latency for room operations, requires handling Redis connection failures gracefully.
- **Verdict**: The industry standard for multi-node Socket.io deployments (used by Slack, Trello).

### Alternative 3: External Presence Service (e.g., etcd / ZooKeeper)
- **Pros**: Strong consistency, designed for distributed systems, can survive network partitions.
- **Cons**: Operational complexity is massive overkill for a chat room; ZooKeeper is Java-based and heavy.
- **Verdict**: Only justified in massive MMO or distributed consensus scenarios.

## Decision: Express Static Server vs. Separate CDN

### Alternative 1: Express Static (`express.static`)
- **Pros**: One server, one port, no CORS issues, trivial local development.
- **Cons**: Node.js is inefficient at serving static assets under load; blocks the event loop for large file reads.
- **Verdict**: Perfect for this scope.

### Alternative 2: Separate CDN / Nginx
- **Pros**: Offloads bandwidth, better caching, geographic distribution.
- **Cons**: Extra deployment step; CORS and cookie sharing must be configured between CDN and API.
- **Verdict**: Recommended for production but unnecessary here.

### Alternative 3: Vite Dev Server Proxy
- **Pros**: Fast HMR for frontend development.
- **Cons**: Not suitable for production; requires build step.
- **Verdict**: Great during development only.
