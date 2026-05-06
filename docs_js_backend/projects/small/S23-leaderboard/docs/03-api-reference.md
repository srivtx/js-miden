# 03-api-reference.md

## POST /score

Submit a score for a user.

**Body:**
```json
{
  "userId": "user-1",
  "username": "Alice",
  "score": 1500,
  "period": "daily"
}
```

**Response:**
```json
{ "id": "abc", "userId": "user-1", "score": 1500, "period": "daily" }
```

## GET /leaderboard

Get top ranked players.

**Query:** `?period=daily|weekly|all-time&limit=100`

**Response:**
```json
[
  { "rank": 1, "userId": "u1", "username": "Alice", "score": 1500 }
]
```

## GET /rank/:userId

Get a specific user's rank.

**Query:** `?period=daily|weekly|all-time`
