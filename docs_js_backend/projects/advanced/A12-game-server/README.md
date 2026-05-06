# A12: Game Server Backend

Multiplayer game backend with skill-based matchmaking, game state management, leaderboards, and anti-cheat.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/matchmaking/register | POST | Register player |
| /api/matchmaking/queue | POST | Join matchmaking queue |
| /api/game/:sessionId/state | POST | Update game state |
| /api/game/:sessionId/finish | POST | Finish game |
| /api/leaderboard | GET | Get leaderboard |

## Architecture

- **Matchmaking Service**: Skill-based pairing with Elo-like rating
- **Game State Service**: Authoritative state updates (intended to be)
- **Leaderboard Service**: Ranking and statistics
- **Anti-Cheat Service**: Basic validation layer

## Known Issues (for debugging practice)

1. **BUG**: No state validation (client sends "I have 999 health", server accepts it)
2. **BUG**: Matchmaking exploits (smurf accounts always matched with beginners)

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
