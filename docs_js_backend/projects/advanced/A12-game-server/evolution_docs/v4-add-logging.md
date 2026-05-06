# v4 — Add Logging (Game Server)

## The Scenario

It's 2am. A tournament is live. Your junior stares at the console: "The last thing I see is `Game server running on port 3000`. Then nothing." Players report desync. You check the logs. There are no logs. Just console output that vanished when the container restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/:sessionId/state', (req, res, next) => {
  try {
    const parsed = updateStateSchema.parse(req.body);
    const session = updateGameState(req.params.sessionId, req.userId!, parsed);
    console.log('Updated state:', session?.state.tick); // <-- This is not logging
    res.json(session);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the pod restarts, logs are gone. You can't investigate the desync.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the state update failure.

3. **No levels**: Every message is the same priority. A player join notification and a fatal crash look identical.

4. **No structure**: `"Updated state: 42"` — good luck parsing that in Grafana. You need JSON for log aggregation.

5. **No request tracing**: A player reports "I teleported and died." Which request? Which session? Which tick? You have no correlation ID.

## The Solution: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production: output JSON for log aggregators
  // In dev: pretty print for humans
});
```

```typescript
// src/routes/game.ts
import { logger } from '../utils/logger.js';

app.post('/:sessionId/state', (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /state', sessionId: req.params.sessionId, playerId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Updating game state');
    const parsed = updateStateSchema.parse(req.body);

    const session = updateGameState(req.params.sessionId, req.userId!, parsed);
    childLogger.info({ tick: session?.state.tick }, 'Game state updated');

    res.json(session);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to update game state');
    next(err);
  }
});
```

### Production log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "pid": 42,
  "hostname": "game-server-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /state",
  "sessionId": "sess-456",
  "playerId": "player-42",
  "tick": 150,
  "msg": "Game state updated"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in Grafana | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.post('/:sessionId/finish', (req, res) => {
  finishGame(req.params.sessionId, req.body.winnerId);
  res.status(204).send();
  // Who finished it? When? What was the final score? You'll never know.
});

// With logging:
app.post('/:sessionId/finish', (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /finish', sessionId: req.params.sessionId });

  try {
    childLogger.info({ winnerId: req.body.winnerId }, 'Finishing game');
    const session = finishGame(req.params.sessionId, req.body.winnerId);
    childLogger.info({ winnerId: req.body.winnerId, finalTick: session?.state.tick }, 'Game finished');
    res.status(204).send();
  } catch (err) {
    childLogger.error({ err, sessionId: req.params.sessionId }, 'Failed to finish game');
    next(err);
  }
});
```

## Logging Evolution in the Game Server

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which state update failed, what the input was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When a player reports desync at 3am during a tournament, logs are the only witness. Console.log is a Post-it note. Pino is a black box."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the anti-cheat rejects teleportation?

## Next: v5 — Add Testing
