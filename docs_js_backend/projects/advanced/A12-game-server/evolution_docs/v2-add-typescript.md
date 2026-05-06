# v2 — Add TypeScript (Game Server)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why a player's health never updates. "JavaScript doesn't care," they mutter. The client sent `heath` instead of `health`. The server silently ignored it. You hand them TypeScript.

## The PAIN: Dynamic Typing in Game State

From v1, we had this bug:

```javascript
app.post('/move', (req, res) => {
  const { playerId, x, y, z, heath } = req.body; // <-- typo
  players[playerId].heath = heath; // Creates a new property 'heath'. Real property is 'health'.
  res.json(players[playerId]); // Health still 100. Player is invincible.
});
```

This compiles. Runs. Creates a ghost property `heath`. The real `health` is never modified. The player becomes unkillable.

### More typos that bite you:

```javascript
// Wrong property access
player.postion // undefined (real property is 'position')

// Wrong state key
session.state.players // undefined (real property is 'players')

// Score as string
player.score = "999" // String concatenation instead of addition
```

These runtime errors happen in production. Players exploit invincibility bugs. Leaderboards break. At 2am.

## The Solution: TypeScript

```typescript
// src/types.ts
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

```typescript
// src/services/gameState.ts
import type { GameSession, PlayerState } from '../types.js';

export function updateGameState(
  sessionId: string,
  playerId: string,
  clientState: Partial<PlayerState>
): GameSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const current = session.state.players[playerId];
  if (!current) return null;

  // TypeScript ensures clientState matches PlayerState shape
  session.state.players[playerId] = { ...current, ...clientState };
  session.state.tick += 1;
  session.state.timestamp = new Date();
  updateSession(session);
  return session;
}
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.heath` | Runtime creates ghost property | **Compile error**: Property 'heath' does not exist |
| `player.postion` | Runtime `undefined` | **Compile error**: Property 'postion' does not exist |
| `score: "999"` | Runtime string | **Compile error**: Type 'string' not assignable to 'number' |
| Missing `tick` field | Runtime `undefined` | **Compile error**: Property 'tick' is missing |
| `status: 'don'` | Runtime accepted | **Compile error**: Type '"don"' not assignable |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/:sessionId/state', (req: Request, res: Response) => {
  const update = req.body as any; // "I don't care about types"
  updateGameState(req.params.sessionId, req.userId!, update); // accepts teleport coordinates
});
```

Using `as any` defeats the purpose. It's like disabling collision detection because "it works most of the time."

## The Realization

> Junior: "TypeScript caught `heath` before I deployed. That typo would have made every player invincible."
>
> You: "That's not a bug — that's TypeScript doing its job. In a game server, a typo in state update logic is an exploit waiting to happen."

## Why this matters for the Game Server

Our state model evolves fast:
- v1: `{ health, position, score }`
- v2: `{ health, maxHealth, position, score, ammo }`

Without types, you add `ammo` to the spawn logic but forget it in the state sync. With types, the compiler reminds you: *"Hey, PlayerState.ammo exists, but your update handler ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **client** sends `{ health: 999, position: { x: 9999, y: 0, z: 9999 } }`. For that, we need validation.

## Next: v3 — Add Validation
