import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDb, query, closeDb } from '../src/services/db.js';
import { registerConsumer, pollAndDispatch, setConsumerOffset } from '../src/services/eventBus.js';
import { handleCacheUpdate, getCache, clearCache } from '../src/consumers/cacheConsumer.js';
import { handleNotification, getNotifications, clearNotifications } from '../src/consumers/notificationConsumer.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await query('DELETE FROM cdc_events');
  await query('DELETE FROM cdc_offsets');
  await query('DELETE FROM orders');
  await query('DELETE FROM users');
  clearCache();
  clearNotifications();
});

afterAll(async () => {
  await closeDb();
});

describe('CDC Basic Flow', () => {
  it('should publish INSERT event when user is created', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'alice@example.com', name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('alice@example.com');

    const events = await query('SELECT * FROM cdc_events WHERE table_name = $1', ['users']);
    expect(events.rows.length).toBe(1);
    expect(events.rows[0].operation).toBe('INSERT');
  });

  it('should publish UPDATE event when user is updated', async () => {
    const createRes = await request(app)
      .post('/users')
      .send({ email: 'bob@example.com', name: 'Bob' });

    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/users/${id}`)
      .send({ name: 'Robert' });

    expect(res.status).toBe(200);

    const events = await query('SELECT * FROM cdc_events WHERE operation = $1', ['UPDATE']);
    expect(events.rows.length).toBe(1);
  });

  it('should publish DELETE event when user is deleted', async () => {
    const createRes = await request(app)
      .post('/users')
      .send({ email: 'charlie@example.com', name: 'Charlie' });

    const id = createRes.body.data.id;

    const res = await request(app).delete(`/users/${id}`);
    expect(res.status).toBe(204);

    const events = await query('SELECT * FROM cdc_events WHERE operation = $1', ['DELETE']);
    expect(events.rows.length).toBe(1);
  });
});

describe('CDC Consumer — Cache', () => {
  it('should update cache after consuming events', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'dave@example.com', name: 'Dave' });

    const user = res.body.data;

    registerConsumer('cache', handleCacheUpdate);
    await pollAndDispatch('cache');

    expect(getCache().get(`user:${user.id}`)).toEqual(user);
  });
});

describe('BUG: Missed Changes', () => {
  it('should not skip events when consumer offset is reset incorrectly', async () => {
    // Create two users
    const r1 = await request(app).post('/users').send({ email: 'e1@x.com', name: 'E1' });
    const r2 = await request(app).post('/users').send({ email: 'e2@x.com', name: 'E2' });

    registerConsumer('cache', handleCacheUpdate);

    // Consume first batch
    await pollAndDispatch('cache');
    expect(getCache().get(`user:${r1.body.data.id}`)).toBeDefined();
    expect(getCache().get(`user:${r2.body.data.id}`)).toBeDefined();

    // Create third user
    const r3 = await request(app).post('/users').send({ email: 'e3@x.com', name: 'E3' });

    // BUG: Simulating a scenario where the consumer offset is somehow advanced
    // past the newest event (e.g., bad checkpoint restoration or manual tampering).
    // In the current code, if we set offset to a future LSN, we skip r3 forever.
    // This demonstrates "missed changes".
    const events = await query('SELECT MAX(lsn) as max FROM cdc_events');
    const maxLsn = Number(events.rows[0].max);
    await setConsumerOffset('cache', maxLsn + 10); // Jump ahead artificially

    clearCache();
    await pollAndDispatch('cache');

    // r3 was skipped because offset is past its LSN
    expect(getCache().get(`user:${r3.body.data.id}`)).toBeUndefined();

    // The real bug test: the system should have detected that offset > maxLsn
    // and either warned or reset. This test documents the failure.
    // NOTE: This test PASSES because the bug exists. In a fixed system,
    // the offset should be validated against the WAL.
  });
});

describe('BUG: Out-of-Order Delivery', () => {
  it('should process events in strict LSN order', async () => {
    registerConsumer('cache', handleCacheUpdate);

    // Create user then update it
    const createRes = await request(app)
      .post('/users')
      .send({ email: 'order@x.com', name: 'Order' });
    const id = createRes.body.data.id;

    await request(app).patch(`/users/${id}`).send({ name: 'OrderUpdated' });

    // The consumer processes events with Promise.all — no ordering guarantee.
    // If INSERT finishes after UPDATE, cache shows old name.
    // We simulate this by adding an artificial delay to INSERT handling.
    let insertHandled = false;
    const delayedHandler = async (event: any) => {
      if (event.operation === 'INSERT') {
        await new Promise((r) => setTimeout(r, 100));
        insertHandled = true;
      }
      await handleCacheUpdate(event);
    };

    registerConsumer('cache-delayed', delayedHandler);
    await pollAndDispatch('cache-delayed');

    const cached = getCache().get(`user:${id}`) as any;

    // BUG: Because events are dispatched concurrently, the UPDATE may overwrite
    // the cache before INSERT finishes (if INSERT is delayed). Even without
    // delay, Promise.all provides no ordering guarantee.
    // In a correct system, events are processed sequentially by LSN.
    // This test documents the out-of-order delivery bug.
    expect(cached?.name).toBe('OrderUpdated');
  });
});
