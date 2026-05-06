# v7 — Production Setup (Game Server)

## The Scenario

It's 2am. Your junior deploys the game server to production. "It works!" they say. Then the container restarts. All active sessions vanish. All leaderboard scores are gone. "But it was working..." they whimper. You check: in-memory Maps. No database. No persistence. Every deploy is a data apocalypse.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const players = new Map<string, Player>(); // In-memory. Ephemeral. Dead on restart.
const sessions = new Map<string, GameSession>(); // Same problem.
```

Local development can survive data loss. Production cannot. Players complete matches. They expect their scores to persist. Leaderboards must survive restarts.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | Plain objects | ❌ No |
| v2 | Plain objects | ❌ No |
| v3 | Plain objects | ❌ No |
| v4 | Plain objects | ❌ No |
| v5 | Plain objects | ❌ No |
| v6 | Plain objects | ❌ No |
| v7 | PostgreSQL + Redis | ✓ Production-ready |

## The Solution: PostgreSQL + Redis + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE players (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  skill_rating INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  player_ids UUID[] NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'finished')),
  winner_id UUID REFERENCES players(id),
  final_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE leaderboard (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Why PostgreSQL?
- **ACID transactions**: Match results are committed atomically
- **JSONB**: Flexible game state storage with indexing
- **Concurrent access**: Row-level locking prevents race conditions
- **Durability**: Write-ahead logging survives crashes

### 2. Redis for Game State Cache

```typescript
// src/services/gameStateCache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getSessionState(sessionId: string): Promise<GameState | null> {
  const cached = await redis.get(`session:${sessionId}`);
  if (cached) return JSON.parse(cached);
  return null;
}

export async function updateSessionState(sessionId: string, state: GameState): Promise<void> {
  await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(state)); // 1 hour TTL
}
```

Why Redis?
- **Sub-millisecond latency**: In-memory cache for hot game state
- **Pub/sub**: Broadcast state updates to connected clients
- **TTL**: Auto-expire finished sessions

### 3. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/game?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
JWT_SECRET="change-me-in-production"
```

### 4. Production Routes (connecting to src/)

```typescript
// src/routes/matchmaking.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/register', async (req, res, next) => {
  try {
    const schema = z.object({
      username: z.string().min(1).max(50),
      skillRating: z.number().int().min(0).max(5000).optional(),
    });
    const parsed = schema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO players (id, username, skill_rating, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [crypto.randomUUID(), parsed.username, parsed.skillRating ?? 1000]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
```

### 5. The Anti-Cheat Fix (Documented)

```typescript
// Server-authoritative state with database persistence:
export async function finishGame(sessionId: string, winnerId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE sessions SET status = 'finished', winner_id = $1, finished_at = NOW() WHERE id = $2`,
      [winnerId, sessionId]
    );

    await client.query(
      `UPDATE players SET games_won = games_won + 1 WHERE id = $1`,
      [winnerId]
    );

    await client.query(
      `UPDATE leaderboard SET score = score + 100, updated_at = NOW() WHERE player_id = $1`,
      [winnerId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

This fix uses **database transactions** to ensure match results are atomic. The server is the single source of truth. Cheats are rejected at the API boundary.

### 6. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "node-pg-migrate up",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | Plain objects | PostgreSQL with WAL |
| Cache | None | Redis with TTL |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked database |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |
| Anti-cheat | Client-authoritative | Server-authoritative + DB |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly leaderboards survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The plain object taught us persistence matters. The client-authoritative state taught us trust models matter. PostgreSQL + Redis is where all those lessons converge. In gaming, player retention depends on fair, persistent competition."

## Files in this project

```
A12-game-server/
├── src/
│   ├── index.ts          # Entry point (ESM)
│   ├── app.ts            # Express app setup
│   ├── routes/
│   │   ├── matchmaking.ts   # Player registration + queue
│   │   ├── game.ts          # State updates + finish
│   │   └── leaderboard.ts   # Score rankings
│   ├── services/
│   │   ├── matchmaker.ts    # TrueSkill matchmaking
│   │   ├── gameState.ts     # Server-authoritative validation
│   │   ├── antiCheat.ts     # Cheat detection
│   │   └── gameStateCache.ts # Redis cache
│   ├── utils/
│   │   └── logger.ts     # Pino structured logging
│   └── types.ts          # TypeScript interfaces
├── migrations/           # PostgreSQL migrations
├── .env.example
├── docker-compose.yml    # PostgreSQL + Redis
├── package.json          # ESM, scripts, dependencies
└── tsconfig.json         # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: object → Map → PostgreSQL + Redis. Each step taught a lesson.
2. **Validation is non-negotiable**: Zod at the boundary prevents cheats from reaching state.
3. **Tests document bugs**: The anti-cheat test proves invalid state is rejected.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Server authority**: The server decides what is possible. The client is untrusted.
