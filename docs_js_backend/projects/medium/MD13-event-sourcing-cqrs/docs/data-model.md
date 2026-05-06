# Data Model

## Entity Relationship Diagram

```
┌──────────────────┐
│    EventStore    │
├──────────────────┤
│ id (PK)          │
│ aggregate_id     │
│ aggregate_type   │
│ event_type       │
│ event_data (JSON)│
│ version          │
│ created_at       │
│ metadata (JSON)  │
└──────────────────┘

┌──────────────────┐
│ OrderReadModel   │
├──────────────────┤
│ id (PK)          │
│ aggregate_id (UQ)│
│ customer_id      │
│ status           │
│ total_amount     │
│ items (JSON)     │
│ shipping_address │
│ version          │
│ projected_at     │
│ updated_at       │
└──────────────────┘

┌──────────────────┐
│    Snapshot      │
├──────────────────┤
│ id (PK)          │
│ aggregate_id     │
│ aggregate_type   │
│ state (JSON)     │
│ version          │
│ created_at       │
└──────────────────┘
```

## Schema

### Event Store
```sql
CREATE TABLE event_store (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  
  UNIQUE (aggregate_id, version),
  INDEX idx_aggregate_version (aggregate_id, version),
  INDEX idx_aggregate_type_created (aggregate_type, created_at),
  INDEX idx_event_type (event_type)
);
```

### Order Read Model
```sql
CREATE TABLE order_read_model (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  aggregate_id TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_amount FLOAT NOT NULL,
  items JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  version INT NOT NULL,
  projected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_projected (projected_at)
);
```

### Snapshot
```sql
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  state JSONB NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (aggregate_id, version),
  INDEX idx_aggregate (aggregate_id)
);
```

## Event Types

### OrderPlaced
```json
{
  "customerId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 29.99
    }
  ],
  "totalAmount": 59.98,
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Springfield",
    "country": "USA",
    "zipCode": "12345"
  }
}
```

### OrderCancelled
```json
{
  "reason": "Changed my mind",
  "cancelledBy": "uuid",
  "cancelledAt": "2024-01-01T12:00:00Z"
}
```

## Event Versioning

### Schema Evolution
```typescript
const ORDER_PLACED_SCHEMA_VERSION = 1;

export function upcastOrderPlacedEvent(
  eventData: Record<string, unknown>,
  sourceVersion: number
): OrderPlacedEvent['eventData'] {
  if (sourceVersion === ORDER_PLACED_SCHEMA_VERSION) {
    return eventData as OrderPlacedEvent['eventData'];
  }
  // Handle migrations from older versions
  return migrateEventData(eventData, sourceVersion);
}
```

## Read Model vs Write Model

### Write Model (Event Store)
- Append-only
- Normalized events
- Immutable
- Versioned
- Audit trail

### Read Model (Projections)
- Query-optimized
- Denormalized
- Mutable (by projection)
- Eventually consistent
- Indexed

## Data Access Patterns

### Command Side
```sql
-- Append event
INSERT INTO event_store (...);

-- Get events for aggregate
SELECT * FROM event_store 
WHERE aggregate_id = ? 
ORDER BY version ASC;
```

### Query Side
```sql
-- Get order by ID (fast, indexed)
SELECT * FROM order_read_model 
WHERE aggregate_id = ?;

-- List orders by customer
SELECT * FROM order_read_model 
WHERE customer_id = ? 
ORDER BY projected_at DESC;

-- Count orders by status
SELECT COUNT(*) FROM order_read_model 
WHERE status = ?;
```

## References

- Event Sourcing Patterns: https://eventstore.com/blog/
- CQRS Data Model: https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs
- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html