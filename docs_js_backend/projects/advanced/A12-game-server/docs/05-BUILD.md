# A12 Game Server: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of WebSockets (though this project uses HTTP)

## Step 1: Project Setup

```bash
mkdir game-server && cd game-server
npm init -y
npm install express jsonwebtoken
npm install -D typescript vitest supertest @types/express @types/node
npx tsc --init
```

## Step 2: Type Definitions

Create `src/types.ts`:
```typescript
export interface Player {
  id: string;
  username: string;
  skillRating: number;
  createdAt: Date;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  score: number;
  ammo: number;
}

export interface GameState {
  players: Record<string, PlayerState>;
  tick: number;
  timestamp: Date;
}

export interface GameSession {
  id: string;
  playerIds: string[];
  status: 'active' | 'finished';
  state: GameState;
  createdAt: Date;
  finishedAt?: Date;
}
```

## Step 3: Database Layer

Create `src/db.ts`:
```typescript
const players = new Map<string, Player>();
const sessions = new Map<string, GameSession>();

export function createPlayer(player: Player): Player {
  players.set(player.id, player);
  return player;
}

export function getPlayers(): Player[] {
  return Array.from(players.values());
}

export function createSession(session: GameSession): void {
  sessions.set(session.id, session);
}

export function getSessionById(id: string): GameSession | undefined {
  return sessions.get(id);
}

export function updateSession(session: GameSession): void {
  sessions.set(session.id, session);
}

export function resetDb(): void {
  players.clear();
  sessions.clear();
}
```

## Step 4: Game State Service (CORRECT Version)

Create `src/services/gameState.ts`:
```typescript
import type { GameSession, PlayerState } from '../types.js';
import { getSessionById, updateSession } from '../db.js';

const MAX_SPEED_PER_TICK = 2.0;
const MAP_BOUNDS = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

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
      // Reject impossible movement
      return session;
    }
    if (
      clientState.position.x < MAP_BOUNDS.minX ||
      clientState.position.x > MAP_BOUNDS.maxX ||
      clientState.position.z < MAP_BOUNDS.minZ ||
      clientState.position.z > MAP_BOUNDS.maxZ
    ) {
      return session;
    }
  }

  // VALIDATION: Health
  if (clientState.health !== undefined && clientState.health > current.health) {
    // Health cannot increase from client input
    return session;
  }

  // VALIDATION: Score
  if (clientState.score !== undefined) {
    // Score is server-authoritative
    return session;
  }

  // Apply validated changes
  session.state.players[playerId] = { ...current, ...clientState };
  session.state.tick += 1;
  session.state.timestamp = new Date();
  updateSession(session);
  return session;
}

export function finishGame(sessionId: string, winnerId: string): GameSession | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  session.status = 'finished';
  session.finishedAt = new Date();
  updateSession(session);
  return session;
}
```

## Step 5: Matchmaker (CORRECT Version with TrueSkill Concept)

Create `src/services/matchmaker.ts`:
```typescript
import type { Player, GameSession } from '../types.js';
import { getPlayers, createSession } from '../db.js';

const matchmakingQueue: Player[] = [];
const MAX_SKILL_GAP = 200;

function matchQuality(mu1: number, sigma1: number, mu2: number, sigma2: number): number {
  // Simplified TrueSkill match quality
  const diff = mu1 - mu2;
  const variance = sigma1 ** 2 + sigma2 ** 2;
  return Math.exp(-(diff ** 2) / (2 * variance));
}

export function queuePlayer(player: Player): GameSession | null {
  const candidates = matchmakingQueue.filter(p =>
    p.id !== player.id && Math.abs(p.skillRating - player.skillRating) <= MAX_SKILL_GAP
  );

  // Sort by match quality (descending) instead of raw skill (ascending)
  candidates.sort((a, b) => {
    const qualityA = matchQuality(player.skillRating, 50, a.skillRating, 50);
    const qualityB = matchQuality(player.skillRating, 50, b.skillRating, 50);
    return qualityB - qualityA;
  });

  if (candidates.length > 0) {
    const opponent = candidates[0];
    const idx = matchmakingQueue.findIndex(p => p.id === opponent.id);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);

    const session: GameSession = {
      id: crypto.randomUUID(),
      playerIds: [player.id, opponent.id],
      status: 'active',
      state: {
        players: {
          [player.id]: { health: 100, maxHealth: 100, position: { x: 0, y: 0, z: 0 }, score: 0, ammo: 30 },
          [opponent.id]: { health: 100, maxHealth: 100, position: { x: 10, y: 0, z: 10 }, score: 0, ammo: 30 },
        },
        tick: 0,
        timestamp: new Date(),
      },
      createdAt: new Date(),
    };

    createSession(session);
    return session;
  }

  matchmakingQueue.push(player);
  return null;
}

export function clearQueue(): void {
  matchmakingQueue.length = 0;
}
```

## Step 6: Routes

Create `src/routes/game.ts`:
```typescript
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getSessionById } from '../db.js';
import { updateGameState, finishGame } from '../services/gameState.js';

const router = Router();

router.post('/:sessionId/state', authMiddleware, (req: AuthRequest, res) => {
  const session = updateGameState(req.params.sessionId, req.userId!, req.body);
  if (!session) {
    res.status(404).json({ error: 'Session not found or not active' });
    return;
  }
  res.json(session.state);
});

router.post('/:sessionId/finish', authMiddleware, (req: AuthRequest, res) => {
  const session = finishGame(req.params.sessionId, req.body.winnerId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

export { router as gameRouter };
```

## Step 7: Testing

Create `tests/game.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Game Server', () => {
  beforeEach(() => resetDb());

  it('should reject impossible health values', async () => {
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
});
```

## Step 8: Run

```bash
npx vitest
```
