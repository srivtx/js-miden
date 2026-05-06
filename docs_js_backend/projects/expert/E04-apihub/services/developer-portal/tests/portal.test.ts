import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';

describe('Developer Portal Service', () => {
  describe('POST /apis/register', () => {
    it('should register a new API', async () => {
      const res = await request(app)
        .post('/apis/register')
        .send({
          developerId: 'dev_123',
          name: 'Weather API',
          baseUrl: 'https://api.weather.com',
          routes: [
            { path: '/current', method: 'GET', description: 'Current weather' }
          ]
        });
      
      expect(res.status).to.equal(201);
      expect(res.body.api.name).to.equal('Weather API');
    });

    it('should require developerId, name, baseUrl', async () => {
      const res = await request(app)
        .post('/apis/register')
        .send({ name: 'Incomplete' });
      
      expect(res.status).to.equal(400);
    });
  });

  describe('GET /apis/:apiId', () => {
    it('should return registered API', async () => {
      const registerRes = await request(app)
        .post('/apis/register')
        .send({
          developerId: 'dev_456',
          name: 'Stock API',
          baseUrl: 'https://api.stocks.com',
          routes: []
        });
      
      const apiId = registerRes.body.api.id;
      const res = await request(app).get(`/apis/${apiId}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.api.name).to.equal('Stock API');
    });
  });

  describe('POST /webhooks/register', () => {
    it('should register a webhook', async () => {
      const res = await request(app)
        .post('/webhooks/register')
        .send({
          developerId: 'dev_123',
          apiId: 'api_123',
          url: 'https://example.com/webhook',
          events: ['usage.threshold', 'billing.invoice']
        });
      
      expect(res.status).to.equal(201);
      expect(res.body.webhook).to.have.property('secret');
    });
  });

  describe('POST /webhooks/:id/trigger', () => {
    it('should trigger webhook with HMAC signature', async () => {
      const whRes = await request(app)
        .post('/webhooks/register')
        .send({
          developerId: 'dev_123',
          apiId: 'api_123',
          url: 'https://example.com/webhook',
          events: ['usage.threshold']
        });
      
      const webhookId = whRes.body.webhook.id;
      
      const res = await request(app)
        .post(`/webhooks/${webhookId}/trigger`)
        .send({
          event: 'usage.threshold',
          payload: { usage: 9500, limit: 10000 }
        });
      
      expect(res.status).to.equal(200);
      expect(res.body.triggered).to.be.true;
      expect(res.body.signature).to.be.a('string');
    });
  });
});
