# MD05 Collaborative Whiteboard — v2 Adding TypeScript

## The Bug

You just debugged why a stroke drawn on mobile looks like a dot on desktop.

```js
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  board.push(msg.stroke);
});
```

A mobile client sent:
```json
{ "stroke": { "x": 100, "y": 200, "color": "#ff0000" } }
```

Desktop expected:
```json
{ "stroke": { "points": [{"x":100,"y":200},{"x":101,"y":201}], "width": 2, "color": "#ff0000" } }
```

Mobile sent a single point. Desktop expected an array of points with stroke width. The rendering code crashed on `stroke.points.map`.

TypeScript would have caught the missing `points` array at compile time.

## The Fix: Types First

```ts
// types.ts
export interface Point {
  x: number;
  y: number;
  t: number; // timestamp for replay speed
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser' | 'line' | 'rect';
  userId: string;
  createdAt: Date;
}

export interface WhiteboardState {
  boardId: string;
  strokes: Stroke[];
  cursors: Map<string, Cursor>;
  version: number; // for OT/CRDT
}

export interface Cursor {
  userId: string;
  x: number;
  y: number;
  color: string;
  lastSeen: Date;
}

export interface BoardMessage {
  type: 'stroke' | 'cursor' | 'delete' | 'undo' | 'init' | 'sync';
  payload: unknown;
  timestamp: number;
  userId: string;
  seq?: number; // sequence number for ordering
}
```

## The Whiteboard Service Interface

```ts
// whiteboardService.ts
export interface IWhiteboardService {
  getBoard(boardId: string): Promise<WhiteboardState>;
  applyStroke(boardId: string, stroke: Stroke): Promise<WhiteboardState>;
  deleteStroke(boardId: string, strokeId: string, userId: string): Promise<void>;
  getStrokeHistory(boardId: string, afterSeq: number): Promise<Stroke[]>;
  broadcastCursor(boardId: string, cursor: Cursor): void;
}
```

## Why Types Matter Here

Real-time collaboration has complex message shapes:
- `Stroke` must have `points[]` — never a single point
- `Cursor` must have `lastSeen` for heartbeat detection
- `BoardMessage` must have `seq` for ordering guarantees
- `version` is needed for conflict resolution

Without types, every client implementation guesses the shape. With types, the contract is enforced.

**Next:** Let's add validation so we don't accept strokes with zero points or negative coordinates.
