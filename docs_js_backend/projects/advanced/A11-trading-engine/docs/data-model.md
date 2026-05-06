# Data Model

## Order

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | string | Trader identifier |
| symbol | string | Ticker symbol |
| side | enum(buy,sell) | Order side |
| type | enum(limit,market) | Order type |
| price | decimal | Limit price (0 for market) |
| quantity | integer | Total quantity |
| filledQuantity | integer | Filled so far |
| status | enum | open, partially_filled, filled, cancelled |
| createdAt | timestamp | Creation time |

## Trade

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| buyOrderId | UUID | Reference to buy order |
| sellOrderId | UUID | Reference to sell order |
| symbol | string | Ticker symbol |
| price | decimal | Execution price |
| quantity | integer | Filled quantity |
| createdAt | timestamp | Execution time |

## Order Book Snapshot

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | Ticker |
| bids | array | Price levels on buy side |
| asks | array | Price levels on sell side |
| lastTradePrice | decimal | Last executed price |
