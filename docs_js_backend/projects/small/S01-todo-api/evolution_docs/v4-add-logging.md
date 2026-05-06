# v4 — Add Logging (Todo API)

## The Scenario

It's 2am. Production is down. Your junior stares at the console: "The last thing I see is `Server running on port 3000`. Then nothing." You check the logs. There are no logs. Just console output that vanished when PM2 restarted the process.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/todos', async (req, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const todo = await prisma.todo.create({ data: parsed });
    console.log('Created todo:', todo.id); // <-- This is not logging
    res.status(201).json(todo);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. PM2 might keep it... or not. When the server restarts, logs are gone.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone.

3. **No levels**: Every message is the same priority. An info log and a fatal crash look identical.

4. **No structure**: `"Created todo: abc123"` — good luck parsing that in Datadog/Grafana. You need JSON.

5. **No request tracing**: User reports "my todo disappeared." Which request? Which user? Which timestamp? You have no correlation ID.

## The Solution: Structured Logging with Pino

```typescript
// logger.ts
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
// routes.ts
import { logger } from '../logger.js';

app.post('/todos', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /todos' });
  
  try {
    childLogger.info({ body: req.body }, 'Creating todo');
    const parsed = createSchema.parse(req.body);
    
    const todo = await prisma.todo.create({ data: parsed });
    childLogger.info({ todoId: todo.id }, 'Todo created successfully');
    
    res.status(201).json(todo);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to create todo');
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
  "hostname": "api-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /todos",
  "todoId": "xyz-789",
  "msg": "Todo created successfully"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in Datadog | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.delete('/todos/:id', async (req, res) => {
  await prisma.todo.delete({ where: { id: req.params.id } });
  res.status(204).send();
  // Who deleted it? When? From what IP? You'll never know.
});

// With logging:
app.delete('/todos/:id', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'DELETE /todos/:id', userId: req.user?.id });
  
  try {
    childLogger.info({ todoId: req.params.id }, 'Deleting todo');
    await prisma.todo.delete({ where: { id: req.params.id } });
    childLogger.info({ todoId: req.params.id }, 'Todo deleted');
    res.status(204).send();
  } catch (err) {
    childLogger.error({ err, todoId: req.params.id }, 'Failed to delete todo');
    next(err);
  }
});
```

## Logging Evolution in Todo API

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which request failed, what the input was, and the full error stack. In JSON."
> 
> You: "Logs are your flight recorder. When production crashes at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment?

## Next: v5 — Add Testing
