# v7 — Production Setup (Service Split + Resilience)

Your auction works. But it's one monolith handling HTTP bids, WebSocket broadcasts, bid history, and anti-sniping logic. A memory leak in WebSocket handling kills bid processing. It's time to split.

---

## Architecture Evolution: Monolith → Services

```
Monolith (v1-v6)
    ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Auction   │────▶│  WebSocket  │────▶│   History   │
│   Service   │     │   Gateway   │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘
        │                                        │
        └──────────────▶ Redis ◀─────────────────┘
```

---

## Pain #1: WebSocket Load Kills Bid Processing

10,000 watchers on one auction. Every bid broadcasts to all 10,000. The event loop is blocked. New bids timeout.

**Fix:** Separate WebSocket Gateway.

```ts
// websocket-gateway/src/index.ts
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';

const redis = new Redis({ host: process.env.REDIS_HOST });
const subscriber = new Redis({ host: process.env.REDIS_HOST });

const wss = new WebSocketServer({ port: 3001 });

// Subscribe to auction updates from Redis
subscriber.subscribe('auction:updates');
subscriber.on('message', (channel, message) => {
  const update = JSON.parse(message);
  broadcastToAuction(update.auctionId, update);
});

function broadcastToAuction(auctionId: string, data: unknown) {
  const clients = auctionRooms.get(auctionId) || new Set();
  const payload = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}
```

The Auction Service publishes to Redis. The WebSocket Gateway subscribes and broadcasts. They scale independently.

---

## Pain #2: Race Conditions at Scale

Two bids arrive on two different Auction Service instances. Both read from the same DB row. Both think they're highest.

**Fix:** Atomic bid processing with Redis + Lua.

```ts
// auction-service/src/bids.ts
const PLACE_BID_LUA = `
  local auctionKey = KEYS[1]
  local bidKey = KEYS[2]
  local user = ARGV[1]
  local amount = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local highest = tonumber(redis.call('hget', auctionKey, 'highest')) or 0
  if amount <= highest then
    return {err = 'Bid too low'}
  end

  redis.call('hset', auctionKey, 'highest', amount)
  redis.call('zadd', bidKey, now, user .. ':' .. amount)
  return {ok = 'accepted'}
`;

const result = await redis.eval(
  PLACE_BID_LUA,
  2,
  `auction:${auctionId}`,
  `auction:${auctionId}:bids`,
  user,
  amount,
  Date.now()
);
```

Redis Lua scripts execute atomically. No race conditions.

---

## Pain #3: No Persistent Bid History

Server restarts. All bids vanish. You need durable history.

**Fix:** History Service + Event Sourcing.

```ts
// history-service/src/index.ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER!] });
const consumer = kafka.consumer({ groupId: 'history-service' });

await consumer.subscribe({ topic: 'auction.bids', fromBeginning: true });

await consumer.run({
  eachMessage: async ({ message }) => {
    const bid = JSON.parse(message.value!.toString());
    await db.insertInto('bid_history').values(bid).execute();
  },
});
```

Every bid is an event in Kafka. The History Service materializes them into PostgreSQL. Replay the log, rebuild any state.

---

## Pain #4: Sniping Destroys Trust

Auction ends at 3:00:00. Sniper bids at 2:59:59. Legitimate bidder has no time.

**Fix:** Anti-sniping logic in Auction Service.

```ts
const ANTI_SNIPING_EXTENSION_MS = 60_000;

function processBid(auction: Auction, bid: Bid): BidResult {
  const timeRemaining = auction.endsAt.getTime() - Date.now();

  if (timeRemaining < ANTI_SNIPING_EXTENSION_MS && timeRemaining > 0) {
    auction.endsAt = new Date(auction.endsAt.getTime() + ANTI_SNIPING_EXTENSION_MS);
    logger.info({ auctionId: auction.id, newEndTime: auction.endsAt }, 'Auction extended (anti-sniping)');

    // Publish extension event
    redis.publish('auction:updates', JSON.stringify({
      auctionId: auction.id,
      type: 'extended',
      newEndTime: auction.endsAt,
    }));
  }

  // ... atomic bid check
}
```

Last-minute bids extend the auction by 60 seconds. Fairness is restored.

---

## Pain #5: Service Crashes Cascade

WebSocket Gateway goes down. Auction Service keeps accepting bids but can't notify watchers. Users think they're winning when they're not.

**Fix:** Circuit breakers + health checks.

```ts
// auction-service/src/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private state: 'CLOSED' | 'OPEN' = 'CLOSED';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        setTimeout(() => (this.state = 'CLOSED'), 30000);
      }
      throw err;
    }
  }
}

// Publish to Redis with circuit breaker
await breaker.execute(() => redis.publish('auction:updates', payload));
```

If Redis is down, the circuit opens. The Auction Service queues updates locally and retries. It doesn't crash.

---

## Final Checklist

- [ ] Auction Service: atomic Lua-based bidding
- [ ] WebSocket Gateway: separate, scalable, Redis Pub/Sub
- [ ] History Service: Kafka event sourcing → PostgreSQL
- [ ] Anti-sniping: extend auction on last-minute bids
- [ ] Circuit breakers: prevent cascading failures
- [ ] Health checks: `/health` on every service
- [ ] Graceful shutdown: drain connections, finish processing
- [ ] Environment-based config: Redis, Kafka, DB hosts

This is a production auction system. It started as a naive `Map`-based monolith. Now it's a resilient, multi-service architecture with atomic bidding, real-time updates, durable history, and anti-sniping protection.
