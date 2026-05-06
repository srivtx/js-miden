# Troubleshooting

## Lost Bids

**Symptom:** User's bid accepted but not reflected in auction state.

**Cause:** Race condition in read-then-write bid logic.

**Fix:**
```sql
BEGIN;
SELECT * FROM auctions WHERE id = $1 FOR UPDATE;

-- Validate within transaction
IF $2 <= current_price THEN
  ROLLBACK;
  RETURN 'Bid too low';
END IF;

INSERT INTO bids ...;
UPDATE auctions SET current_price = $2 ...;
COMMIT;
```

## Clock Skew

**Symptom:** Auction ends at wrong time.

**Cause:** Servers have different system times.

**Fix:**
- NTP synchronization on all servers
- Use database time: `SELECT NOW()`
- Store all times in UTC

## WebSocket Disconnections

**Symptom:** Clients miss bid updates.

**Fix:**
- Heartbeat pings every 30 seconds
- Reconnect with exponential backoff
- Fallback polling every 5 seconds
