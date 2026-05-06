import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';
import { tiers } from '../../src/routes/invoices.js';

describe('Billing Service', () => {
  beforeEach(() => {
    tiers.clear();
  });

  describe('POST /tiers/create', () => {
    it('should create a subscription tier', async () => {
      const res = await request(app)
        .post('/tiers/create')
        .send({
          apiId: 'api_billing',
          name: 'Pro',
          requestsPerMonth: 50000,
          rateLimitPerSecond: 100,
          pricePerMonth: 49.99,
          overagePricePerRequest: 0.001
        });
      
      expect(res.status).to.equal(201);
      expect(res.body.tier.name).to.equal('Pro');
    });
  });

  describe('POST /invoices/calculate', () => {
    it('should calculate invoice with no overage', async () => {
      const tierRes = await request(app)
        .post('/tiers/create')
        .send({
          apiId: 'api_billing',
          name: 'Basic',
          requestsPerMonth: 1000,
          rateLimitPerSecond: 10,
          pricePerMonth: 9.99,
          overagePricePerRequest: 0.01
        });
      
      const tierId = tierRes.body.tier.id;
      
      const invoiceRes = await request(app)
        .post('/invoices/calculate')
        .send({
          apiKeyId: 'key_123',
          apiId: 'api_billing',
          tierId,
          developerId: 'dev_123',
          totalRequests: 500
        });
      
      expect(invoiceRes.status).to.equal(200);
      expect(invoiceRes.body.invoice.baseAmount).to.equal(9.99);
      expect(invoiceRes.body.invoice.overageAmount).to.equal(0);
    });

    it('should calculate invoice with overage', async () => {
      const tierRes = await request(app)
        .post('/tiers/create')
        .send({
          apiId: 'api_billing',
          name: 'Basic',
          requestsPerMonth: 1000,
          rateLimitPerSecond: 10,
          pricePerMonth: 9.99,
          overagePricePerRequest: 0.01
        });
      
      const tierId = tierRes.body.tier.id;
      
      const invoiceRes = await request(app)
        .post('/invoices/calculate')
        .send({
          apiKeyId: 'key_123',
          apiId: 'api_billing',
          tierId,
          developerId: 'dev_123',
          totalRequests: 1500
        });
      
      expect(invoiceRes.status).to.equal(200);
      expect(invoiceRes.body.invoice.overageAmount).to.equal(5.00);
      expect(invoiceRes.body.invoice.totalAmount).to.equal(14.99);
    });
  });
});
