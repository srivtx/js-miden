# MD05 Collaborative Whiteboard — v3 Adding Validation

## The Attack

You thought TypeScript was enough. Then a user sent this:

```json
{ "type": "stroke", "stroke": { "points": [], "color": "red", "width": 999999 } }
```

An empty points array. The renderer crashes on `stroke.points[0]`. Then a width of 999,999 pixels. The canvas tries to draw a 1km-wide line. The browser freezes.

Then someone sent:
```json
{ "type": "stroke", "stroke": { "points": [{"x":0,"y":0,"t":0},{"x":1e308,"y":1e308,"t":0}] } }
```

Infinity coordinates. The WebGL context crashes. All users lose their session.

## The Fix: Defense in Depth

### 1. Message Validation (Zod)

```ts
import { z } from 'zod';

const pointSchema = z.object({
  x: z.number().finite().min(-1e6).max(1e6),
  y: z.number().finite().min(-1e6).max(1e6),
  t: z.number().int().min(0).max(86400000), // ms in a day
});

const strokeSchema = z.object({
  id: z.string().uuid(),
  points: z.array(pointSchema).min(2).max(10000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(0.5).max(100),
  tool: z.enum(['pen', 'eraser', 'line', 'rect']),
  userId: z.string().uuid(),
});

const cursorSchema = z.object({
  userId: z.string().uuid(),
  x: z.number().finite().min(-1e6).max(1e6),
  y: z.number().finite().min(-1e6).max(1e6),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stroke'), payload: strokeSchema }),
  z.object({ type: z.literal('cursor'), payload: cursorSchema }),
  z.object({ type: z.literal('delete'), payload: z.object({ strokeId: z.string().uuid() }) }),
]);

export type BoardMessage = z.infer<typeof messageSchema>;
```

### 2. Business Rule Validation

```ts
async function applyStroke(boardId: string, stroke: Stroke): Promise<void> {
  // Rate limit: max 1000 strokes per user per minute
  const recent = await redis.zcount(
    `board:${boardId}:user:${stroke.userId}:strokes`,
    Date.now() - 60000,
    Date.now()
  );
  if (recent > 1000) {
    throw new Error('Stroke rate limit exceeded');
  }

  // Deduplication
  const exists = await redis.exists(`stroke:${stroke.id}`);
  if (exists) {
    return; // Already applied
  }

  // Bounding box check (optional: prevent off-canvas spam)
  const xs = stroke.points.map(p => p.x);
  const ys = stroke.points.map(p => p.y);
  if (Math.max(...xs) - Math.min(...xs) > 100000) {
    throw new Error('Stroke too large');
  }

  await db.query(
    'INSERT INTO strokes (id, board_id, points, color, width, tool, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
    [stroke.id, boardId, JSON.stringify(stroke.points), stroke.color, stroke.width, stroke.tool, stroke.userId]
  );

  await redis.setex(`stroke:${stroke.id}`, 3600, '1');
  await redis.zadd(`board:${boardId}:user:${stroke.userId}:strokes`, Date.now(), stroke.id);
}
```

### 3. Database Constraints

```sql
CREATE TABLE strokes (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  points JSONB NOT NULL CHECK (jsonb_array_length(points) >= 2),
  color CHAR(7) NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  width NUMERIC NOT NULL CHECK (width >= 0.5 AND width <= 100),
  tool VARCHAR(20) NOT NULL CHECK (tool IN ('pen', 'eraser', 'line', 'rect')),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strokes_board ON strokes (board_id, created_at);
```

## The Bug

You validate message shape but not message ordering. A malicious client sends `delete` for a stroke before it exists. Other clients crash. You'll need operational transforms for that.

**Next:** Let's add logging so we can trace performance and detect abuse.
