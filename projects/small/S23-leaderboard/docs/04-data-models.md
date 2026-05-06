# 04-data-models.md

## ScoreEntry

| Field     | Type                  | Description                  |
|-----------|-----------------------|------------------------------|
| id        | string                | Entry ID                     |
| userId    | string                | Player identifier            |
| username  | string                | Display name                 |
| score     | number                | Numeric score                |
| timestamp | Date                  | Submission time              |
| period    | 'daily'|'weekly'|'all-time' | Leaderboard period  |

## LeaderboardEntry

| Field    | Type   | Description          |
|----------|--------|----------------------|
| rank     | number | Position (1-based)   |
| userId   | string | Player identifier    |
| username | string | Display name         |
| score    | number | Numeric score        |
