# API Reference

## Authentication

All endpoints require Bearer token except registration/login.

## Endpoints

### POST /api/auth/register
Register a new user.

**Body:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Response:**
```json
{
  "id": "uuid",
  "username": "alice",
  "email": "alice@example.com"
}
```

### POST /api/auth/login
Authenticate and receive JWT token.

**Body:**
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

**Response:**
```json
{
  "token": "jwt-token"
}
```

### POST /api/posts
Create a new post.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "content": "Hello world!"
}
```

### GET /api/posts/feed
Get user's feed.

**Query Parameters:**
- `offset` (number): Offset for pagination (BUG: use cursor instead)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  "posts": [...],
  "offset": 0,
  "limit": 20,
  "total": 100
}
```

### POST /api/posts/:id/like
Like a post.

### POST /api/posts/:id/retweet
Retweet a post.

### POST /api/users/:id/follow
Follow a user.
