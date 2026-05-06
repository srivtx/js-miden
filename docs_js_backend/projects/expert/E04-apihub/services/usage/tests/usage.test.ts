import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';
import { aggregates } from '../../src/routes/tracking.js';

describe('Usage Service', () => {
  beforeEach(() => {
    // Clear aggregates between tests
    aggregates.clear();
  });

  describe('POST /track', () => {
    it('should record a usage event', async () => {
      const res = await request(app)
        .post('/track')
        .send({
          apiKeyId: 'key_123',
          apiId: 'api_123',
          developerId: 'dev_123',
          endpoint: '/users',
          method: 'GET',
          statusCode: 200,
          responseTimeMs: 45
        });
      
      expect(res.status).to.equal(201);
      expect(res.body.recorded).to.be.true;
    });

    it('should create aggregate for new key+api+month', async () => {
      await request(app)
        .post('/track')
        .send({
          apiKeyId: 'key_123',
          apiId: 'api_123',
          developerId: 'dev_123',
          endpoint: '/users',
          method: 'GET',
          statusCode: 200,
          responseTimeMs: 45
        });
      
      const now = new Date();
      const res = await request(app)
        .get(`/track/aggregate/key_123?apiId=api_123&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.aggregate.totalRequests).to.equal(1);
    });

    // BUG TEST: This test demonstrates the double-counting vulnerability
    it('SHOULD FAIL: should atomically aggregate under concurrent requests', async () => {
      const apiKeyId = 'key_concurrent';
      const apiId = 'api_concurrent';
      const developerId = 'dev_concurrent';
      
      // Simulate 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/track')
          .send({
            apiKeyId,
            apiId,
            developerId,
            endpoint: '/test',
            method: 'GET',
            statusCode: 200,
            responseTimeMs: 10
          })
      );
      
      await Promise.all(promises);
      
      const now = new Date();
      const res = await request(app)
        .get(`/track/aggregate/${apiKeyId}?apiId=${apiId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      
      // This SHOULD be 10, but due to the race condition it will often be less
      // The test documents the expected correct behavior
      expect(res.body.aggregate.totalRequests).to.equal(10);
    });
  });

  describe('GET /track/records/:apiKeyId', () => {
    it('should return usage records for a key', async () => {
      await request(app)
        .post('/track')
        .send({
          apiKeyId: 'key_records',
          apiId: 'api_123',
          developerId: 'dev_123',
          endpoint: '/users',
          method: 'GET',
          statusCode: 200,
          responseTimeMs: 45
        });
      
      const res = await request(app).get('/track/records/key_records');
      expect(res.status).to.equal(200);
      expect(res.body.records).to.have.length(1);
    });
  });
});
