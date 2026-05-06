import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';

describe('Analytics Service', () => {
  describe('POST /metrics/event', () => {
    it('should record a metric event', async () => {
      const res = await request(app)
        .post('/metrics/event')
        .send({
          apiId: 'api_analytics',
          endpoint: '/test',
          method: 'GET',
          responseTimeMs: 50,
          statusCode: 200
        });
      
      expect(res.status).to.equal(201);
      expect(res.body.recorded).to.be.true;
    });
  });

  describe('GET /metrics/dashboard/:apiId', () => {
    it('should return dashboard metrics', async () => {
      // Record some events
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/metrics/event')
          .send({
            apiId: 'api_dash',
            endpoint: '/users',
            method: 'GET',
            responseTimeMs: 30 + i * 10,
            statusCode: i === 4 ? 500 : 200
          });
      }
      
      const res = await request(app).get('/metrics/dashboard/api_dash');
      
      expect(res.status).to.equal(200);
      expect(res.body.totalRequests).to.equal(5);
      expect(res.body.errorRate).to.be.greaterThan(0);
    });
  });
});
