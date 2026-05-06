# S06 Chat Rooms — Real-World Examples

## Slack Architecture

Slack is one of the most well-documented large-scale chat systems. Their real-time message delivery is powered by **WebSockets** (specifically the WSS protocol) with a sophisticated fallback to long-polling for restrictive corporate proxies.

### Key Architectural Decisions
1. **Flannel**: Slack's WebSocket service written in Go. It maintains persistent connections to clients and fans out messages.
2. **Kafka**: Messages are written to Kafka topics per workspace ("team") before being delivered. This decouples message ingestion from delivery, smoothing out traffic spikes.
3. **Vitess**: Sharded MySQL stores channel metadata, user preferences, and message history. The real-time layer (Flannel) only handles the "live" fan-out; historical fetches go to the database.

**Lesson**: Separation of concerns—real-time delivery is optimized for speed (in-memory/Kafka), while persistence is optimized for durability (SQL/sharded stores).

### Trade-off: Kafka vs. Direct Pub/Sub
- **Direct Redis Pub/Sub** is faster for small deployments but lacks persistence and replay.
- **Kafka** adds durability and replayability (new consumers can catch up) at the cost of latency (~10–50 ms) and operational complexity.

## Discord Architecture

Discord handles **millions of concurrent WebSocket connections** per server cluster. They use:
- **Elixir / Erlang VM (BEAM)**: Lightweight processes (actors) handle each WebSocket connection. BEAM processes are cheaper than OS threads, allowing millions per machine.
- **ScyllaDB**: A Cassandra-compatible wide-column store for message history. Messages are partitioned by `channel_id` and clustered by `created_at`.
- **Redis**: Presence tracking (who is online in a guild) and rate limiting.

### Trade-off: Elixir vs. Node.js
- **Node.js**: Single-threaded event loop is simpler but cannot handle CPU-intensive tasks without blocking; one uncaught exception kills the process.
- **Elixir/BEAM**: Processes are isolated (failure of one does not crash others), and hot code reloading is built-in. The trade-off is a smaller hiring pool and learning curve.

## WhatsApp Architecture

WhatsApp famously used **Erlang** from the beginning. Their design prioritizes:
- **Battery life on mobile**: Modified MQTT protocol with very long keepalive intervals.
- **Message queuing**: If a user is offline, messages are stored in a queue (Mnesia, later Riak) and delivered when they reconnect.
- **End-to-end encryption**: Messages are encrypted on the sender's device; the server only sees ciphertext.

### Trade-off: Custom Protocol vs. WebSockets
- **WebSockets**: Standard, easy to debug in browser DevTools.
- **Custom MQTT/XMPP**: More efficient for mobile (smaller headers, binary framing), but requires custom client libraries.

## Twitch Chat

Twitch uses **IRC over WebSocket** (and plain IRC). This hybrid approach:
- Leverages decades of IRC tooling.
- Allows third-party bots to connect via standard IRC libraries.
- Scales by sharding channels across many IRC servers.

**Lesson**: You don't always need to invent a new protocol. Wrapping a mature text protocol in WebSocket frames can accelerate development and interoperability.

## Common Patterns Across All Platforms
1. **Shard by workspace/channel/guild**: No single server handles all connections.
2. **Decouple ingestion from delivery**: Write to a message bus first.
3. **Use presence heartbeats with TTL**: Don't rely on graceful disconnect (mobile networks drop silently).
4. **Client-side message IDs**: Prevent duplicate display if the server retries delivery.
