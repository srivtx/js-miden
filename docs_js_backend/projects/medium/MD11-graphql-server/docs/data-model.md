# Data Model

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │     Post     │       │   Comment    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email (UQ)   │──────<│ author_id(FK)│>──────│ post_id (FK) │
│ name         │       │ title        │       │ author_id(FK)│
│ role         │       │ content      │       │ content      │
│ created_at   │       │ published    │       │ created_at   │
│ updated_at   │       │ created_at   │       └──────────────┘
└──────────────┘       │ updated_at   │
                       └──────────────┘
```

## Schema

### User
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Post
```sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Comment
```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  content TEXT NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Indexes

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| users | email | Lookup by email |
| posts | author_id | User's posts query |
| posts | published | Published posts filter |
| comments | post_id | Post's comments query |
| comments | author_id | User's comments query |

## Data Access Patterns

### N+1 Problem
Without DataLoader, querying posts with authors generates N+1 queries:
```sql
SELECT * FROM posts;           -- 1 query
SELECT * FROM users WHERE id = ? -- N queries (one per post)
```

With DataLoader:
```sql
SELECT * FROM posts;           -- 1 query
SELECT * FROM users WHERE id IN (...) -- 1 batched query
```

### Query Complexity

| Field | Weight | Rationale |
|-------|--------|-----------|
| users | 10 | Returns multiple entities |
| posts | 10 | Returns multiple entities |
| comments | 5 | Returns multiple entities |
| user | 3 | Single entity lookup |
| post | 3 | Single entity lookup |
| author | 5 | Cross-entity join |

## Redis Schema

### Persisted Queries
```
Key: pq:<sha256_hash>
Value: GraphQL query string
TTL: 86400 seconds
```

### Subscription State
```
Key: sub:<subscription_id>
Value: WebSocket connection info
TTL: Session-based
```

## Migration Strategy

1. Create new schema version
2. Deploy with backward compatibility
3. Migrate data
4. Remove old fields

## References

- Prisma Documentation: https://www.prisma.io/docs/
- PostgreSQL Index Types: https://www.postgresql.org/docs/current/indexes-types.html