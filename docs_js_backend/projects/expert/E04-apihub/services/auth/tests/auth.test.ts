import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/index.js';

describe('Auth Service', () => {
  describe('POST /auth/register', () => {
    it('should register a new developer', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'dev@test.com', name: 'Test Developer' });
      
      expect(res.status).to.equal(201);
      expect(res.body.developer).to.have.property('id');
      expect(res.body.developer.email).to.equal('dev@test.com');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'dev@test.com' });
      
      expect(res.status).to.equal(400);
      expect(res.body.error).to.include('required');
    });
  });

  describe('GET /auth/developer/:id', () => {
    it('should return registered developer', async () => {
      const registerRes = await request(app)
        .post('/auth/register')
        .send({ email: 'find@test.com', name: 'Find Me' });
      
      const id = registerRes.body.developer.id;
      const res = await request(app).get(`/auth/developer/${id}`);
      
      expect(res.status).to.equal(200);
      expect(res.body.developer.email).to.equal('find@test.com');
    });

    it('should return 404 for unknown developer', async () => {
      const res = await request(app).get('/auth/developer/unknown-id');
      expect(res.status).to.equal(404);
    });
  });
});
