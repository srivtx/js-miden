# v5 — Add Testing (Game Server)

## The Scenario

It's 2am. Your junior refactors the game state update logic. "Just moving some logic around," they say. They deploy. Players report they can teleport and heal themselves. Your junior stares at the code — it looks fine. But they never tested the anti-cheat validation.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/services/gameState.ts
export function updateGameState(
  sessionId: string,
  playerId: string,
  clientState: Partial<PlayerState>
): GameSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const current = session.state.players[playerId];
  if (!current) return null;

  // VALIDATION: Position
  if (clientState.position) {
    const dist = distance(current.position, clientState.position);
    if (dist > MAX_SPEED_PER_TICK) {
      return session; // Reject impossible movement
    }
  }

  // BUG: During refactor, this check was accidentally removed
  if (clientState.health !== undefined && clientState.health > current.health) {
    // Health cannot increase from client input
    return session;
  }

  session.state.players[playerId] = { ...current, ...clientState };
  session.state.tick += 1;
  updateSession(session);
  return session;
}
```

This code has an **anti-cheat bypass** (accidentally removed health check). A client sends `health: 999`. The server accepts it. The player becomes invincible.

Without tests, this bug ships to production. Players exploit it. Leaderboards break.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/game.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Game Server', () => {
  beforeEach(() => resetDb());

  describe('Matchmaking', () => {
    it('registers a player', async () => {
      const res = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      expect(res.status).toBe(201);
      expect(res.body.username).toBe('alice');
    });

    it('matches players within skill gap', async () => {
      await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1050 });

      const res = await request(app)
        .post('/api/matchmaking/queue')
        .set('Authorization', `Bearer ${makeToken('alice-id')}`);
      expect(res.body.session).toBeDefined();
    });
  });

  describe('Game State', () => {
    it('rejects impossible health values', async () => {
      const p1 = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2 = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1000 });

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p1.body.id)}`);
      const matchRes = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p2.body.id)}`);
      const session = matchRes.body.session;

      const stateRes = await request(app)
        .post(`/api/game/${session.id}/state`)
        .set('Authorization', `Bearer ${makeToken(p1.body.id)}`)
        .send({ health: 999, score: 99999 });

      expect(stateRes.body.players[p1.body.id].health).toBe(100); // Not 999
      expect(stateRes.body.players[p1.body.id].score).toBe(0);    // Not 99999
    });

    it('rejects teleportation', async () => {
      const p1 = await request(app).post('/api/matchmaking/register').send({ username: 'alice', skillRating: 1000 });
      const p2 = await request(app).post('/api/matchmaking/register').send({ username: 'bob', skillRating: 1000 });

      await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p1.body.id)}`);
      const matchRes = await request(app).post('/api/matchmaking/queue').set('Authorization', `Bearer ${makeToken(p2.body.id)}`);
      const session = matchRes.body.session;

      const stateRes = await request(app)
        .post(`/api/game/${session.id}/state`)
        .set('Authorization', `Bearer ${makeToken(p1.body.id)}`)
        .send({ position: { x: 9999, y: 0, z: 9999 } });

      const pos = stateRes.body.players[p1.body.id].position;
      expect(pos.x).not.toBe(9999); // Teleport rejected
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor removes health check | Deploy, cheaters find out | **CI fails** before merge |
| Teleportation exploit | Players abuse it | **Test rejects** impossible movement |
| Score manipulation | Leaderboards break | **Test verifies** score is server-authoritative |
| Matchmaking imbalance | Retention drops | **Test checks** skill gap enforcement |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real database in unit tests
// - Slow (100ms+ per test)
// - Flaky (race conditions, state leakage)
// - Requires Docker/CI setup

// DO mock the database layer
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the database
```

Mocking the database means:
- Your tests run in milliseconds
- No database setup required
- You control every response (error cases, empty lobbies, edge cases)

## Testing Evolution in the Game Server

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for teleportation. It passes, but if someone removes the distance check, the test fails. The test is a guard rail."
>
> You: "Tests are documentation that executes. A passing test for anti-cheat is a contract with your future self. In a game server, one untested refactor turns your competitive game into a cheat fest."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
