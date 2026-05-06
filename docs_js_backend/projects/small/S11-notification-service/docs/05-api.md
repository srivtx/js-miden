# S11 Notification Service — API Reference

## Notifications

### Create Notification
`POST /notifications/notify`

**Request Body**
```json
{
  "user_id": "alice",
  "type": "like",
  "title": "New like",
  "body": "Bob liked your post",
  "data": { "post_id": 123, "actor_id": "bob" }
}
```

**Response 201**
```json
{
  "id": 1,
  "unread_count": 3
}
```

**Known Issue**: The unread count update uses a read-modify-write pattern and is vulnerable to race conditions under concurrent loads.

### List Notifications
`GET /notifications?user_id=&page=&limit=`

**Response 200**
```json
{
  "data": [
    { "id": 1, "user_id": "alice", "type": "like", "title": "New like", "body": "Bob liked your post", "read": 0, "created_at": 1700000000000 }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

### Mark as Read
`PATCH /notifications/:id/read`

**Response 200**
```json
{ "success": true }
```

**Known Issue**: The decrement of `unread_count` is also a read-modify-write and races under concurrency.

### SSE Stream
`GET /notifications/stream?user_id=`

**Response**: `text/event-stream`

```
data: {"user_id":"alice","unread_count":3}

data: {"user_id":"alice","unread_count":2}

```

The server sends the current count on connect, then pushes updates whenever notifications are created or marked read.

## Error Scenarios

| Scenario | Status | Notes |
|----------|--------|-------|
| Missing user_id | 400 | On notify or list |
| Missing title/body | 400 | On notify |
| Invalid notification ID | 404 | On mark read |
