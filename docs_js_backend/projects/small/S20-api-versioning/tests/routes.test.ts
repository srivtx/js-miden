import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('API Versioning', () => {
  it('v2 should return split names', async () => {
    const res = await request(app).get('/v2/users');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body[0].firstName);
    assert.ok(res.body[0].lastName);
  });

  // FAILING TEST: Breaking change without version bump
  it('v1 should return { name } not { firstName, lastName }', async () => {
    const res = await request(app).get('/v1/users');
    assert.strictEqual(res.status, 200);
    
    // v1 should return { name: string } for backward compatibility
    const user = res.body[0];
    assert.ok(user.name, 'v1 should have name field');
    assert.strictEqual(user.firstName, undefined, 'v1 should NOT have firstName');
    assert.strictEqual(user.lastName, undefined, 'v1 should NOT have lastName');
  });

  // FAILING TEST: No deprecation notice
  it('should include deprecation notice in headers', async () => {
    const res = await request(app)
      .get('/v1/users')
      .set('Accept', 'application/vnd.api.v1+json');
    
    // Should include deprecation headers
    const deprecation = res.get('Deprecation');
    const sunset = res.get('Sunset');
    
    assert.ok(deprecation, 'Should include Deprecation header');
    assert.ok(sunset, 'Should include Sunset header');
  });
});
