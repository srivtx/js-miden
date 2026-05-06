# API Reference

## Authentication

Bearer token required for all endpoints except registration.

## Matchmaking

### POST /api/matchmaking/register
Register a new player.

**Body:**
```json
{
  "username": "player1",
  "skillRating": 1000
}
```

### POST /api/matchmaking/queue
Join matchmaking queue.

**Response:**
```json
{
  "matched": true,
  "session": {
    "id": "uuid",
    "playerIds": ["p1", "p2"],
    "status": "active"
  }
}
```

## Game

### POST /api/game/:sessionId/state
Update game state.

**Body:**
```json
{
  "health": 80,
  "position": { "x": 10, "y": 0, "z": 5 },
  "score": 100,
  "ammo": 25
}
```

**BUG:** No server-side validation. Client can send any values.

### POST /api/game/:sessionId/finish
Finish game and record winner.

**Body:**
```json
{
  "winnerId": "player-uuid"
}
```

## Leaderboard

### GET /api/leaderboard
Get top players.
