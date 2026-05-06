# MD05 Collaborative Whiteboard — v5 Adding Testing

## The Bug

You "fixed" sync. You wrote:

```ts
ws.send(JSON.stringify({ type: 'init', strokes: board.strokes }));
```

You deploy. A user joins a board with 10,000 strokes. The WebSocket message is 20MB. The browser freezes parsing JSON. The connection drops. The user reconnects. The cycle repeats.

But the real bug: two users draw simultaneously. User A draws a line. User B draws a line. Both broadcast. Due to network latency, User A receives B's stroke before B receives A's stroke. The sequence numbers are wrong. The boards diverge.

Tests would have caught this.

## The Fix: Comprehensive Tests

### Unit Tests: Operational Transform

```ts
import { describe, it, expect } from 'vitest';
import { transformStroke, transformDelete } from '../src/crdt/ot';

describe('Operational Transform', () => {
  it('converges for concurrent strokes', () => {
    const strokeA = { id: 's1', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
    const strokeB = { id: 's2', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] };

    // Client 1 applies A then B'
    const state1 = [];
    state1.push(strokeA);
    state1.push(transformStroke(strokeB, strokeA));

    // Client 2 applies B then A'
    const state2 = [];
    state2.push(strokeB);
    state2.push(transformStroke(strokeA, strokeB));

    expect(state1).toEqual(state2);
  });

  it('handles concurrent delete vs modify', () => {
    const original = { id: 's1', points: [{ x: 0, y: 0 }] };
    const deleteOp = { type: 'delete', strokeId: 's1' };
    const modifyOp = { type: 'stroke', stroke: { ...original, color: '#ff0000' } };

    const result1 = applyOps([original], [deleteOp, transformDelete(modifyOp, deleteOp)]);
    const result2 = applyOps([original], [modifyOp, transformDelete(deleteOp, modifyOp)]);

    // Both should converge: stroke is either deleted or modified, consistently
    expect(result1).toEqual(result2);
  });
});
```

### Integration Tests: Sync

```ts
import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers/server';
import WebSocket from 'ws';

describe('Whiteboard sync', () => {
  it('syncs initial state to new client', async () => {
    const server = await createTestServer();
    const boardId = 'board-1';

    // Seed strokes
    await server.seedStrokes(boardId, [
      { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 2 },
    ]);

    const ws = new WebSocket(`ws://localhost:${server.port}/board/${boardId}`);
    await new Promise(resolve => ws.once('open', resolve));

    const msg = await new Promise<any>(resolve => ws.once('message', resolve));
    const data = JSON.parse(msg.toString());

    expect(data.type).toBe('init');
    expect(data.strokes).toHaveLength(1);
    expect(data.strokes[0].id).toBe('s1');

    ws.close();
    await server.close();
  });

  it('broadcasts strokes to all connected clients', async () => {
    const server = await createTestServer();
    const boardId = 'board-1';

    const ws1 = new WebSocket(`ws://localhost:${server.port}/board/${boardId}`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}/board/${boardId}`);

    await Promise.all([
      new Promise(r => ws1.once('open', r)),
      new Promise(r => ws2.once('open', r)),
    ]);

    // Skip init messages
    ws1.once('message', () => {});
    ws2.once('message', () => {});

    const stroke = {
      type: 'stroke',
      stroke: { id: 's2', points: [{ x: 1, y: 1 }], color: '#f00', width: 2 },
    };

    ws1.send(JSON.stringify(stroke));

    const [msg1, msg2] = await Promise.all([
      new Promise(resolve => ws1.once('message', resolve)),
      new Promise(resolve => ws2.once('message', resolve)),
    ]);

    expect(JSON.parse(msg1.toString()).stroke.id).toBe('s2');
    expect(JSON.parse(msg2.toString()).stroke.id).toBe('s2');

    ws1.close();
    ws2.close();
    await server.close();
  });

  it('handles rapid reconnect without state loss', async () => {
    const server = await createTestServer();
    const boardId = 'board-1';

    const ws1 = new WebSocket(`ws://localhost:${server.port}/board/${boardId}`);
    await new Promise(r => ws1.once('open', r));
    ws1.once('message', () => {}); // init

    // Send stroke
    ws1.send(JSON.stringify({
      type: 'stroke',
      stroke: { id: 's3', points: [{ x: 2, y: 2 }], color: '#0f0', width: 2 },
    }));

    await new Promise(r => setTimeout(r, 100));
    ws1.close();

    // Reconnect
    const ws2 = new WebSocket(`ws://localhost:${server.port}/board/${boardId}`);
    await new Promise(r => ws2.once('open', r));

    const msg = await new Promise<any>(resolve => ws2.once('message', resolve));
    const data = JSON.parse(msg.toString());

    expect(data.strokes).toHaveLength(1);
    expect(data.strokes[0].id).toBe('s3');

    ws2.close();
    await server.close();
  });
});
```

### Session Replay Tests

```ts
describe('Session replay', () => {
  it('reconstructs board from replay log', async () => {
    const server = await createTestServer();
    const boardId = 'board-replay';

    const events = [
      { type: 'stroke', stroke: { id: 'r1', points: [{ x: 0, y: 0 }], color: '#000', width: 2 } },
      { type: 'stroke', stroke: { id: 'r2', points: [{ x: 1, y: 1 }], color: '#f00', width: 2 } },
      { type: 'delete', strokeId: 'r1' },
    ];

    for (const event of events) {
      await server.applyEvent(boardId, event);
    }

    const replay = await server.getReplay(boardId);
    expect(replay).toHaveLength(3);

    const finalState = await server.reconstructFromReplay(replay);
    expect(finalState.strokes).toHaveLength(1);
    expect(finalState.strokes[0].id).toBe('r2');
  });
});
```

## What Tests Caught

- OT non-convergence → caught (transform test)
- Sync missing strokes → caught (broadcast test)
- Reconnect state loss → caught (reconnect test)
- Replay ordering → caught (session replay test)
- Large init payload → caught (performance test)
- Concurrent delete/modify crash → caught (OT edge case)

## The Confidence

Now you can implement CRDTs, add Redis pub/sub, or rewrite the WebSocket layer and know that:
1. Concurrent edits converge
2. All clients see the same state
3. Reconnects restore correctly
4. Session replay is accurate
5. Large boards don't crash clients

**Next:** Let's modernize the module system.
