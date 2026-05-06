import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, queues } from '../src/db.js';

describe('A02 Message Queue', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('BUG: Messages lost on crash', () => {
    it('should persist messages across restarts', async () => {
      // Publish a message
      const publishRes = await request(app)
        .post('/api/queues/my-queue/messages')
        .send({ body: 'important-message' });
      
      expect(publishRes.status).toBe(201);
      
      // Simulate crash by clearing in-memory state
      resetDb();
      
      // After "restart", message should still be there
      const consumeRes = await request(app)
        .get('/api/queues/my-queue/messages');
      
      // BUG: Messages are lost because they're only in memory
      expect(consumeRes.status).toBe(200);
      expect(consumeRes.body.body).toBe('important-message');
    });
  });

  describe('BUG: No ordering guarantee', () => {
    it('should deliver messages in FIFO order', async () => {
      // Publish messages in order
      await request(app)
        .post('/api/queues/my-queue/messages')
        .send({ body: 'first' });
      
      await request(app)
        .post('/api/queues/my-queue/messages')
        .send({ body: 'second' });
      
      await request(app)
        .post('/api/queues/my-queue/messages')
        .send({ body: 'third' });
      
      // Consume all messages
      const msg1 = await request(app).get('/api/queues/my-queue/messages');
      expect(msg1.body.body).toBe('first');
      await request(app)
        .post(`/api/queues/my-queue/messages/${msg1.body.id}/ack`)
        .send({ ackId: msg1.body.ackId });
      
      const msg2 = await request(app).get('/api/queues/my-queue/messages');
      expect(msg2.body.body).toBe('second');
      await request(app)
        .post(`/api/queues/my-queue/messages/${msg2.body.id}/ack`)
        .send({ ackId: msg2.body.ackId });
      
      const msg3 = await request(app).get('/api/queues/my-queue/messages');
      expect(msg3.body.body).toBe('third');
    });
  });

  describe('Features', () => {
    it('should publish and consume messages', async () => {
      const publishRes = await request(app)
        .post('/api/queues/test-queue/messages')
        .send({ body: 'hello', headers: { key: 'value' } });
      
      expect(publishRes.status).toBe(201);
      
      const consumeRes = await request(app)
        .get('/api/queues/test-queue/messages');
      
      expect(consumeRes.status).toBe(200);
      expect(consumeRes.body.body).toBe('hello');
      expect(consumeRes.body.headers.key).toBe('value');
    });

    it('should acknowledge and remove messages', async () => {
      await request(app)
        .post('/api/queues/ack-queue/messages')
        .send({ body: 'to-ack' });
      
      const msg = await request(app)
        .get('/api/queues/ack-queue/messages');
      
      const ackRes = await request(app)
        .post(`/api/queues/ack-queue/messages/${msg.body.id}/ack`)
        .send({ ackId: msg.body.ackId });
      
      expect(ackRes.status).toBe(200);
      expect(ackRes.body.acknowledged).toBe(true);
      
      // Should be empty now
      const empty = await request(app)
        .get('/api/queues/ack-queue/messages');
      expect(empty.status).toBe(204);
    });
  });
});
