# Data Model

## Auctions Table

```sql
CREATE TABLE auctions (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  starting_price DECIMAL(12,2) NOT NULL,
  current_price DECIMAL(12,2) NOT NULL,
  highest_bidder_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'created',
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Bids Table

```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id),
  bidder_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Indexes

```sql
CREATE INDEX idx_bids_auction ON bids(auction_id, created_at DESC);
CREATE INDEX idx_auctions_status ON auctions(status, ends_at);
```

## Atomic Bid Transaction

```sql
BEGIN;
SELECT * FROM auctions WHERE id = $1 FOR UPDATE;
-- Check amount > current_price
INSERT INTO bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3);
UPDATE auctions 
  SET current_price = $3, highest_bidder_id = $2 
  WHERE id = $1;
COMMIT;
```

## State Transitions

| From | To | Trigger |
|------|-----|---------|
| created | active | Admin starts auction |
| active | extended | Bid in last 30s |
| extended | closed | Time expires |
| active | closed | Time expires |
