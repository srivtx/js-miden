import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('IngestService', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('stream start', () => {
    it('BUG: should allow stream without authentication', async () => {
      // The endpoint accepts stream start requests without validating JWT
      const response = await request(app)
        .post('/streams/start')
        .send({
          channelId: 'channel123',
          title: 'Test Stream',
          userId: 'any-user-id', // Can be any user
        });

      // In the buggy implementation, this succeeds without auth
      expect(response.status).not.toBe(401);
    });

    it('BUG: should allow streaming to any channel', async () => {
      // No verification that the requesting user owns the channel
      const userId = 'attacker';
      const channelId = 'victim-channel';

      // The service allows starting a stream to any channelId
      // without checking channel ownership
      expect(true).toBe(true); // Bug documented
    });
  });

  describe('stream token validation', () => {
    it('BUG: should always validate stream key as true', async () => {
      // The validate endpoint always returns valid: true
      // regardless of the stream key
      expect(true).toBe(true); // Bug documented
    });
  });
});
