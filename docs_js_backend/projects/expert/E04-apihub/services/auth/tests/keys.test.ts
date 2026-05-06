import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';

describe('Auth Service - Keys', () => {
  let developerId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'keys@test.com', name: 'Key Tester' });
    developerId = res.body.developer.id;
  });

  describe('POST /keys/create', () => {
    it('should create a new API key', async () => {
      const res = await request(app)
        .post('/keys/create')
        .send({ developerId, apiId: 'api_123', tierId: 'tier_free' });
      
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('key');
      expect(res.body.apiKey.developerId).to.equal(developerId);
    });
  });

  describe('POST /keys/validate', () => {
    it('should validate an active key', async () => {
      const createRes = await request(app)
        .post('/keys/create')
        .send({ developerId, apiId: 'api_123', tierId: 'tier_free' });
      
      const rawKey = createRes.body.key;
      const validateRes = await request(app)
        .post('/keys/validate')
        .send({ key: rawKey });
      
      expect(validateRes.status).to.equal(200);
      expect(validateRes.body.valid).to.be.true;
    });

    it('should reject invalid key', async () => {
      const res = await request(app)
        .post('/keys/validate')
        .send({ key: 'invalid_key' });
      
      expect(res.status).to.equal(401);
    });
  });

  describe('POST /keys/revoke', () => {
    it('should revoke an active key', async () => {
      const createRes = await request(app)
        .post('/keys/create')
        .send({ developerId, apiId: 'api_123', tierId: 'tier_free' });
      
      const keyId = createRes.body.apiKey.id;
      const revokeRes = await request(app)
        .post('/keys/revoke')
        .send({ keyId });
      
      expect(revokeRes.status).to.equal(200);
      expect(revokeRes.body.revoked).to.be.true;
    });
  });
});
