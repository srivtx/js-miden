# 05-configuration.md

## Environment Variables

| Variable      | Default                    | Description           |
|---------------|----------------------------|-----------------------|
| PORT          | 3000                       | HTTP server port      |
| DATABASE_URL  | postgres://localhost/wishlist | PostgreSQL URL     |

## Database Schema

Phase 1 uses in-memory storage. Production requires:

```sql
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
```

## Docker

```bash
docker-compose up
```

Spins up app and PostgreSQL.
