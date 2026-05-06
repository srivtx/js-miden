# Phase 2-3: Advanced Considerations

## Phase 2: Reliability

### Bid Atomicity
```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT * FROM auctions WHERE id = $1 FOR UPDATE;
-- Validate
INSERT INTO bids ...;
UPDATE auctions SET ...;
COMMIT;
```

### WebSocket Scaling
- Redis Pub/Sub for cross-node broadcast
- Sticky sessions for WebSocket connections
- Fallback to Server-Sent Events

### Auction State Machine
```typescript
const transitions = {
  created: ['active'],
  active: ['extended', 'closed'],
  extended: ['extended', 'closed'],
  closed: [],
};
```

## Phase 3: Scale & Features

### Anti-Sniping Variants
- Dynamic extension (30s from last bid)
- Maximum extension limit (e.g., 10 minutes total)
- Proxy bidding (eBay-style)

### Bid History
- Immutable bid log
- Audit trail for disputes
- Blockchain option for high-value items

### Payment Integration
- Hold funds when bidding
- Charge winner on close
- Refund non-winners

### Real-time Analytics
- Bid velocity tracking
- Price prediction models
- Heat maps of bidder interest
