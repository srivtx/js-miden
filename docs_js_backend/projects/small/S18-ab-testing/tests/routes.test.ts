import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('A/B API', () => {
  it('should return a variant', async () => {
    const res = await request(app)
      .get('/experiments/button-color?userId=u1');
    
    assert.strictEqual(res.status, 200);
    assert.ok(['red', 'blue'].includes(res.body.variant));
  });
});
