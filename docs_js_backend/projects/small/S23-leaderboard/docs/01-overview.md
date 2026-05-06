# 01-overview.md

## WHAT

A real-time leaderboard service that accepts score submissions, ranks players, supports time-based filters (daily/weekly/all-time), and queries individual user ranks.

## WHY

Games and competitive apps need leaderboards to drive engagement. Time-based periods keep competition fresh, and fast rank queries are essential for UX.

## HOW

- `POST /score` — submit a score
- `GET /leaderboard?period=&limit=` — view top ranked players
- `GET /rank/:userId?period=` — get a specific user's rank
