import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';

describe('Gateway Service', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).to.equal(200);
      expect(res.body.service).to.equal('gateway');
    });
  });
});
