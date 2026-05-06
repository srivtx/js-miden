# API Reference

## Routing

### GET /api/route/:userId
Get or assign routing region for a user.

**Query Parameters:**
- `region` (optional): Preferred region

**Response:**
```json
{
  "userId": "user-123",
  "region": "us-east"
}
```

## Data Operations

### POST /api/data/:id
Store or update a record.

**Request:**
```json
{
  "value": { "name": "Alice", "balance": 100 }
}
```

**Response:**
```json
{
  "id": "user-123",
  "value": { "name": "Alice", "balance": 100 },
  "timestamp": 1704067200000,
  "region": "us-east",
  "vectorClock": { "us-east": 1 },
  "version": 1
}
```

### GET /api/data/:id
Retrieve a record.

**Response:**
```json
{
  "id": "user-123",
  "value": { "name": "Alice", "balance": 100 },
  "timestamp": 1704067200000,
  "region": "us-east",
  "vectorClock": { "us-east": 1 },
  "version": 1
}
```

### GET /api/data
List all local records.

## Replication

### POST /api/replicate
Receive a replicated record from another region.

**Request:**
```json
{
  "type": "replicate",
  "record": { ... },
  "sourceRegion": "us-west"
}
```

## Conflict Resolution

### POST /api/conflict/resolve
Manually resolve a conflict between two versions.

**Request:**
```json
{
  "local": { "id": "user-123", "vectorClock": { "us-east": 1 }, ... },
  "remote": { "id": "user-123", "vectorClock": { "us-west": 1 }, ... }
}
```

**Response:**
```json
{
  "winner": { ... },
  "loser": { ... },
  "strategy": "last-write-wins"
}
```

### GET /api/conflicts
Get conflict history.

**Response:**
```json
{
  "count": 5,
  "conflicts": [
    { "recordId": "user-123", "timestamp": 1704067200000, "regions": ["us-east", "us-west"] }
  ]
}
```

## Health

### GET /api/health
Region health status.

**Response:**
```json
{
  "status": "ok",
  "region": "us-east",
  "peers": 2
}
```

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Not found | Record doesn't exist in this region |
| 409 | Conflict | Concurrent update detected |
| 500 | Replication failed | Cross-region sync error |

## References

[1] RESTful API Design Best Practices, Microsoft, 2023.
[2] HTTP Status Codes, RFC 7231.