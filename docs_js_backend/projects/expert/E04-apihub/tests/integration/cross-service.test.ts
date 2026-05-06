import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import gatewayApp from '../../services/gateway/src/index.js';
import authApp from '../../services/auth/src/index.js';
import portalApp from '../../services/developer-portal/src/index.js';
import usageApp from '../../services/usage/src/index.js';
import { targetApis } from '../../services/gateway/src/routes/proxy.js';
import { aggregates } from '../../services/usage/src/routes/tracking.js';

describe('Integration Tests - Security Bugs', () => {
  beforeEach(() => {
    targetApis.clear();
    aggregates.clear();
  });

  describe('BUG-001: Cross-Developer API Key Access', () => {
    it('SHOULD FAIL: Developer A key should NOT access Developer B API', async () => {
      // Register Developer A
      const devARes = await request(authApp)
        .post('/auth/register')
        .send({ email: 'devA@test.com', name: 'Developer A' });
      const devAId = devARes.body.developer.id;

      // Register Developer B
      const devBRes = await request(authApp)
        .post('/auth/register')
        .send({ email: 'devB@test.com', name: 'Developer B' });
      const devBId = devBRes.body.developer.id;

      // Developer B registers an API
      const apiRes = await request(portalApp)
        .post('/apis/register')
        .send({
          developerId: devBId,
          name: 'Secret API',
          baseUrl: 'https://api.devb.com',
          routes: [{ path: '/secret', method: 'GET', description: 'Secret' }]
        });
      const apiId = apiRes.body.api.id;

      // Developer A creates an API key (for their own API)
      const keyRes = await request(authApp)
        .post('/keys/create')
        .send({ developerId: devAId, apiId: 'api_other', tierId: 'tier_free' });
      const devAKey = keyRes.body.key;

      // Register target in gateway
      await request(gatewayApp)
        .post('/proxy/register-target')
        .send({ apiId, baseUrl: 'https://api.devb.com', developerId: devBId });

      // BUG: Developer A uses their key to access Developer B's API
      // The gateway should reject this but it doesn't!
      const proxyRes = await request(gatewayApp)
        .get(`/proxy/${apiId}/secret`)
        .set('x-api-key', devAKey);

      // This SHOULD be 403 Forbidden, but the bug makes it 200
      expect(proxyRes.status).to.equal(403);
      expect(proxyRes.body.error).to.include('not authorized');
    });
  });

  describe('BUG-002: Tier Enforcement Bypass via Header', () => {
    it('SHOULD FAIL: Client should not escalate tier via x-tier-override header', async () => {
      const devRes = await request(authApp)
        .post('/auth/register')
        .send({ email: 'tier@test.com', name: 'Tier Tester' });
      const devId = devRes.body.developer.id;

      const apiRes = await request(portalApp)
        .post('/apis/register')
        .send({ developerId: devId, name: 'Tier API', baseUrl: 'https://tier.com' });
      const apiId = apiRes.body.api.id;

      // Create key
      const keyRes = await request(authApp)
        .post('/keys/create')
        .send({ developerId: devId, apiId, tierId: 'tier_free' });
      const apiKey = keyRes.body.key;

      // Register target
      await request(gatewayApp)
        .post('/proxy/register-target')
        .send({ apiId, baseUrl: 'https://tier.com', developerId: devId });

      // Make some requests
      for (let i = 0; i < 5; i++) {
        await request(gatewayApp)
          .get(`/proxy/${apiId}/test`)
          .set('x-api-key', apiKey);
      }

      // BUG: Client sends x-tier-override: premium to get higher quota
      const quotaRes = await request(usageApp)
        .get(`/quotas/${keyRes.body.apiKey.id}?apiId=${apiId}`)
        .set('x-tier-override', 'premium');

      // The free tier limit is 1000, but the header makes it return 100000
      // The test expects the REAL limit to be enforced
      expect(quotaRes.body.limit).to.equal(1000); // Should be actual tier limit, not overridden
      expect(quotaRes.body.remaining).to.equal(995);
    });
  });

  describe('BUG-003: Non-Atomic Usage Aggregation', () => {
    it('SHOULD FAIL: Concurrent usage tracking should be atomic', async () => {
      const apiKeyId = 'key_atomic';
      const apiId = 'api_atomic';
      const developerId = 'dev_atomic';

      // Simulate 20 concurrent tracking requests
      const promises = Array.from({ length: 20 }, (_, i) =>
        request(usageApp)
          .post('/track')
          .send({
            apiKeyId,
            apiId,
            developerId,
            endpoint: `/endpoint-${i}`,
            method: 'GET',
            statusCode: 200,
            responseTimeMs: 10
          })
      );

      await Promise.all(promises);

      const now = new Date();
      const aggregateRes = await request(usageApp)
        .get(`/track/aggregate/${apiKeyId}?apiId=${apiId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);

      // Due to the race condition in read-modify-write, totalRequests is often < 20
      // The correct behavior is exactly 20
      expect(aggregateRes.body.aggregate.totalRequests).to.equal(20);
    });
  });

  describe('End-to-End: Happy Path', () => {
    it('should successfully proxy a request with valid key and record usage', async () => {
      const devRes = await request(authApp)
        .post('/auth/register')
        .send({ email: 'e2e@test.com', name: 'E2E Tester' });
      const devId = devRes.body.developer.id;

      const apiRes = await request(portalApp)
        .post('/apis/register')
        .send({ developerId: devId, name: 'E2E API', baseUrl: 'https://e2e.com' });
      const apiId = apiRes.body.api.id;

      const keyRes = await request(authApp)
        .post('/keys/create')
        .send({ developerId: devId, apiId, tierId: 'tier_free' });
      const apiKey = keyRes.body.key;

      await request(gatewayApp)
        .post('/proxy/register-target')
        .send({ apiId, baseUrl: 'https://e2e.com', developerId: devId });

      const proxyRes = await request(gatewayApp)
        .get(`/proxy/${apiId}/test`)
        .set('x-api-key', apiKey);

      expect(proxyRes.status).to.equal(200);
      expect(proxyRes.body.proxied).to.be.true;
      expect(proxyRes.headers['x-ratelimit-remaining']).to.exist;

      // Verify usage was recorded
      const now = new Date();
      const usageRes = await request(usageApp)
        .get(`/track/aggregate/${keyRes.body.apiKey.id}?apiId=${apiId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`);

      expect(usageRes.body.aggregate.totalRequests).to.be.at.least(1);
    });
  });
});
