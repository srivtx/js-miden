# Data Model

## Player

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| username | string | Display name |
| skillRating | integer | Elo-like rating |
| wins | integer | Total wins |
| losses | integer | Total losses |
| createdAt | timestamp | Registration time |

## GameSession

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| playerIds | string[] | Participants |
| status | enum | waiting, active, finished |
| state | JSON | Full game state |
| createdAt | timestamp | Start time |
| finishedAt | timestamp | End time |

## GameState

| Field | Type | Description |
|-------|------|-------------|
| players | Record | Per-player state |
| tick | integer | Simulation tick |
| timestamp | timestamp | Last update |

## PlayerState

| Field | Type | Constraints |
|-------|------|-------------|
| health | integer | 0-100 |
| maxHealth | integer | 100 |
| position | object | x,y,z floats |
| score | integer | >= 0 |
| ammo | integer | 0-30 |
