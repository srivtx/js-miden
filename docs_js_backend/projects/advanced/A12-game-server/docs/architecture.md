# Architecture

## Overview

The Game Server Backend provides skill-based matchmaking, authoritative game state management, leaderboards, and anti-cheat validation for multiplayer games.

## Services

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│ Matchmaking │────▶│  PostgreSQL  │
│   (Game)    │◀────│   Service   │◀────│  (Players)   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ WebSocket
       ▼
┌─────────────┐     ┌─────────────┐
│  Game State │────▶│   Redis     │
│   Service   │     │  (Sessions) │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Anti-Cheat │────▶│  Leaderboard│
│   Service   │     │   Service   │
└─────────────┘     └─────────────┘
```

## Matchmaking Flow

1. Player joins queue with skill rating
2. System searches for opponents within `maxSkillGap`
3. If found, create game session
4. If not, player waits in queue

## Game State Flow

1. Clients send state updates (position, health, score)
2. Server receives updates
3. Server should validate and reconcile
4. Server broadcasts authoritative state

**Current Issue:** Server accepts client state without validation.

## Anti-Cheat

Intended checks:
- Health bounds (0 to maxHealth)
- Position sanity (no teleportation)
- Score progression (no instant max)
- Ammo constraints

**Current Issue:** None of these are enforced.
