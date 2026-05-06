# Architecture

## Overview

The Real-time Auction System handles concurrent bidding with strict atomicity requirements and anti-sniping protections.

## Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│  PostgreSQL  │
│             │◀────│   HTTP API  │◀────│  (Auctions, │
└──────┬──────┘     └─────────────┘     │   Bids)      │
       │                                 └─────────────┘
       │
       │ WebSocket
       ▼
┌─────────────┐
│   WS Server │
│  (Broadcast │
│   Updates)  │
└─────────────┘
```

## Auction State Machine

```
CREATED ──▶ ACTIVE ──▶ EXTENDED ──▶ CLOSED
                │           ▲
                └───────────┘
              (bid in last 30s)
```

## Bid Atomicity

### Problem
Two users see current bid at $100:
- User A bids $150
- User B bids $200
- Without atomicity, last write wins regardless of amount

### Solution
```sql
BEGIN;
SELECT * FROM auctions WHERE id = ? FOR UPDATE;
-- Validate bid > current_price
INSERT INTO bids (auction_id, bidder_id, amount) VALUES (?, ?, ?);
UPDATE auctions SET current_price = ?, highest_bidder_id = ? WHERE id = ?;
COMMIT;
```

## Anti-Sniping

- If bid placed within last 30 seconds of auction end
- Extend auction by 30 seconds
- State transitions to EXTENDED
- Prevents last-second sniping

## WebSocket Broadcasting

- Clients connect to `/ws?auctionId=xxx`
- Server maintains mapping: auctionId → WebSocket[]
- On new bid: broadcast to all connected clients
- Fallback: clients can poll HTTP API
