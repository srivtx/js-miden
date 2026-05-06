# Analytics & Monetization

## Overview
The Analytics Service tracks viewer metrics, processes donations, and manages subscriptions.

## Viewer Counting

### Architecture
```
Viewer Joins
    │
    ▼
Analytics Service
    │
    ├──► Redis: INCR viewers:{channelId}
    │
    └──► MongoDB: Create Viewer record
    │
    └──► Redis Pub: Broadcast new count
```

### API Endpoints

#### Join Stream
```
POST /viewers/join
{
  "channelId": "channel123",
  "streamKey": "stream456",
  "viewerId": "viewer789"
}

Response:
{
  "count": 42
}
```

#### Leave Stream
```
POST /viewers/leave
{
  "channelId": "channel123",
  "viewerId": "viewer789"
}

Response:
{
  "count": 41
}
```

#### Get Viewer Count
```
GET /viewers/:channelId

Response:
{
  "channelId": "channel123",
  "count": 42
}
```

## Monetization

### Donations
```
POST /donations
{
  "channelId": "channel123",
  "donorId": "user456",
  "amount": 10.00,
  "message": "Keep it up!",
  "currency": "USD"
}
```

### Subscriptions
```
POST /subscriptions
{
  "channelId": "channel123",
  "subscriberId": "user789",
  "tier": "tier2"
}

GET /subscriptions/:channelId
Response:
{
  "channelId": "channel123",
  "subscriberCount": 150
}
```

### Tiers
| Tier | Price | Benefits |
|------|-------|----------|
| Tier 1 | $4.99/mo | Ad-free, custom emoji |
| Tier 2 | $9.99/mo | Plus: Priority chat |
| Tier 3 | $24.99/mo | Plus: Exclusive streams |

## Stream Analytics
```
GET /stream/:streamKey

Response:
{
  "streamKey": "stream456",
  "currentViewers": 42,
  "totalUniqueViewers": 156,
  "peakViewers": 89,
  "totalDonations": 245.50,
  "newSubscribers": 3
}
```

## Known Vulnerability
**Race condition in viewer count increment/decrement.**

The current implementation reads, modifies, then writes the count - not atomic. Concurrent operations result in inaccurate counts.

### Fix
Use Redis `INCR`/`DECR` commands:
```typescript
// Atomic increment
const newCount = await redis.incr(`viewers:${channelId}`);

// Atomic decrement
const newCount = Math.max(0, await redis.decr(`viewers:${channelId}`));
```
