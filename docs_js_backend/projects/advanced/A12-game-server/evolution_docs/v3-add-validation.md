# v3 — Add Validation (Game Server)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a client sends `POST /state` with `{ health: 999, position: { x: 9999, y: 0, z: 9999 }, score: 99999 }` and the server accepts it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/:sessionId/state', (req: Request, res: Response) => {
  const input: UpdateStateInput = req.body; // Type assertion = TRUST
  // Client sends: { health: 999, position: { x: 9999, y: 0, z: 9999 }, score: 99999 }
  // TypeScript believes it's valid. The game state is corrupted.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as UpdateStateInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Client sends:
{ "health": 999, "position": { "x": 9999, "y": 0, "z": 9999 } }
// Teleportation hack. Health hack. The server accepts it.

{ "score": 99999 }
// Score is server-authoritative, but the client sent it anyway.

{ "ammo": -1 }
// Negative ammo. Could exploit unlimited firing.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/game.ts
import { z } from 'zod';

const positionSchema = z.object({
  x: z.number().min(-50).max(50),
  y: z.number().min(0).max(20),
  z: z.number().min(-50).max(50),
});

const updateStateSchema = z.object({
  position: positionSchema.optional(),
  health: z.number().min(0).max(100).optional(),
  ammo: z.number().int().min(0).max(999).optional(),
}).strict(); // Reject extra fields (score is server-authoritative)
```

```typescript
app.post('/:sessionId/state', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateStateSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const session = updateGameState(req.params.sessionId, req.userId!, parsed);
    res.json(session);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ health: 999 }` | ❌ Accepts via assertion | **Error**: Number must be less than or equal to 100 |
| `{ position: { x: 9999 } }` | ❌ Accepts | **Error**: Number must be less than or equal to 50 |
| `{ score: 99999 }` | ❌ Accepts | **Error**: Unrecognized key(s) in object: 'score' |
| `{ ammo: -1 }` | ❌ Accepts negative | **Error**: Number must be greater than or equal to 0 |
| `{ extra: 'hack' }` | ❌ Accepts | **Error**: Unrecognized key(s) in object: 'extra' |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateState(body: any) {
  if (body.health && body.health > 100) throw new Error('Health too high');
  if (body.position && body.position.x > 50) throw new Error('X too high');
  // ... 50 more lines for every field
  // Forgot to check Y bounds? Wall clip exploit.
  // Forgot to reject score? Score hack.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 10 lines of Zod
- **Inconsistent**: One endpoint checks bounds, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type UpdateStateInput = z.infer<typeof updateStateSchema>;
// Equivalent to: { position?: { x: number; y: number; z: number }; health?: number; ammo?: number }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the Game Server

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime hacks enter state |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a request with `health: 999`. The error message even said 'Number must be less than or equal to 100'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *cheaters* their hacks won't work. Both are necessary. In a game server, one unvalidated state update is an exploit."

## The Next PAIN

Validation catches client hacks, but what about **your** bugs? What happens when the matchmaker throws because of an edge case? What happens when an unhandled promise rejection crashes the process during a tournament?

## Next: v4 — Add Logging
