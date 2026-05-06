# MD05 Collaborative Whiteboard — v4 Adding Logging

## The Incident

A design team reports: "The whiteboard lost half our work." You check the server. It restarted during a deploy. The in-memory `board` array was wiped. You had no persistence. Hours of work vanished.

Then a user says: "My cursor jumps to random places." You check the WebSocket logs. There are none. You can't tell if it's a client bug, network lag, or malicious input.

## The Fix: Structured Logging + Session Replay

```ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export function logBoardEvent(
  event: string,
  boardId: string,
  userId: string,
  metadata?: Record<string, unknown>
) {
  logger.info({
    event: `board_${event}`,
    boardId,
    userId,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}
```

### Logging Every Stroke

```ts
async function applyStroke(boardId: string, stroke: Stroke, userId: string): Promise<void> {
  const start = Date.now();

  try {
    await db.query(
      'INSERT INTO strokes (id, board_id, points, color, width, tool, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
      [stroke.id, boardId, JSON.stringify(stroke.points), stroke.color, stroke.width, stroke.tool, userId]
    );

    logBoardEvent('stroke_applied', boardId, userId, {
      strokeId: stroke.id,
      pointCount: stroke.points.length,
      tool: stroke.tool,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    logBoardEvent('stroke_failed', boardId, userId, {
      strokeId: stroke.id,
      error: (err as Error).message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}
```

### Session Replay Log

```ts
// Append every message to a replay log (Redis stream)
async function appendReplayEvent(boardId: string, message: BoardMessage): Promise<void> {
  const entry = {
    seq: await redis.incr(`board:${boardId}:seq`),
    timestamp: Date.now(),
    userId: message.userId,
    type: message.type,
    payload: JSON.stringify(message.payload),
  };

  await redis.xadd(`board:${boardId}:replay`, '*', 'data', JSON.stringify(entry));

  // Trim to last 10,000 messages
  await redis.xtrim(`board:${boardId}:replay`, 'MAXLEN', 10000);
}
```

### Performance Logging

```ts
wss.on('connection', (ws, req) => {
  const userId = req.headers['x-user-id'] as string;
  const boardId = req.headers['x-board-id'] as string;
  const connectedAt = Date.now();

  logBoardEvent('user_connected', boardId, userId, {
    ip: req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  ws.on('message', (data) => {
    const parseStart = Date.now();
    const msg = JSON.parse(data.toString());
    const parseMs = Date.now() - parseStart;

    if (parseMs > 10) {
      logger.warn({
        event: 'slow_message_parse',
        boardId,
        userId,
        parseMs,
        messageSize: data.length,
      });
    }

    // ... handle message ...
  });

  ws.on('close', () => {
    logBoardEvent('user_disconnected', boardId, userId, {
      durationMs: Date.now() - connectedAt,
    });
  });
});
```

## Observability: What to Log

| Event | Why |
|-------|-----|
| `board_user_connected` | Track concurrent users |
| `board_stroke_applied` | Stroke throughput |
| `board_stroke_failed` | Data loss detection |
| `board_sync_complete` | Join latency |
| `board_replay_event` | Session reconstruction |
| `slow_message_parse` | Performance regression |

## The Dashboard Query

```sql
-- Boards with highest activity (for scaling decisions)
SELECT board_id, COUNT(*) as stroke_count, COUNT(DISTINCT user_id) as active_users
FROM strokes
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY board_id
ORDER BY stroke_count DESC
LIMIT 20;
```

## The Bug

You log every WebSocket message. At 60fps cursor updates from 50 users, that's 3,000 logs per second. Your logging infrastructure chokes. The event loop starves.

**Fix:** Sample high-frequency events. Log 1% of cursor updates, 100% of strokes.

```ts
if (message.type === 'cursor' && Math.random() > 0.01) {
  return; // Skip logging 99% of cursor events
}
```

**Next:** Let's write tests so we can validate sync correctness and conflict resolution.
