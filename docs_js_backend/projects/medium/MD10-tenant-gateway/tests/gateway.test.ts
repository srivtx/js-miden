import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, tenants, apiKeys } from '../src/db.js';
import crypto from 'crypto';

describe('MD10 Tenant Gateway', () => {
  beforeEach(() => {
    resetDb();
  });

  async function createTenant(name: string, subdomain: string) {
    const res = await request(app)
      .post('/api/tenants')
      .send({ name, subdomain });
    return res.body;
  }

  async function createApiKey(tenantId: string) {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/keys`)
      .send({ name: 'test-key' });
    return res.body;
  }

  describe('BUG: Tenant ID from header is spoofable', () => {
    it('should reject requests with tenant ID that does not match API key', async () => {
      const tenantA = await createTenant('Tenant A', 'tenant-a');
      const tenantB = await createTenant('Tenant B', 'tenant-b');
      
      const keyA = await createApiKey(tenantA.id);
      
      // Try to access tenant B's data using tenant A's API key but tenant B's ID
      const res = await request(app)
        .get('/api/gateway/data')
        .set('x-api-key', keyA.key)
        .set('x-tenant-id', tenantB.id);
      
      // BUG: Should reject this but currently accepts it
      expect(res.status).toBe(401);
    });
  });

  describe('BUG: No per-tenant rate limiting', () => {
    it('should rate limit per tenant, not globally', async () => {
      const tenantA = await createTenant('Tenant A', 'tenant-a');
      const tenantB = await createTenant('Tenant B', 'tenant-b');
      
      const keyA = await createApiKey(tenantA.id);
      const keyB = await createApiKey(tenantB.id);
      
      // Exhaust tenant A's rate limit
      for (let i = 0; i < 110; i++) {
        await request(app)
          .get('/api/gateway/data')
          .set('x-api-key', keyA.key)
          .set('x-tenant-id', tenantA.id);
      }
      
      // Tenant B should still be able to make requests
      const res = await request(app)
        .get('/api/gateway/data')
        .set('x-api-key', keyB.key)
        .set('x-tenant-id', tenantB.id);
      
      // BUG: Global rate limit means tenant B is also blocked
      expect(res.status).toBe(200);
    });
  });

  describe('Features', () => {
    it('should create tenant and generate API key', async () => {
      const tenant = await createTenant('Acme Corp', 'acme');
      expect(tenant.id).toBeDefined();
      
      const key = await createApiKey(tenant.id);
      expect(key.key).toMatch(/^tk_/);
    });

    it('should proxy requests with valid credentials', async () => {
      const tenant = await createTenant('Acme Corp', 'acme');
      const key = await createApiKey(tenant.id);
      
      const res = await request(app)
        .get('/api/gateway/data')
        .set('x-api-key', key.key)
        .set('x-tenant-id', tenant.id);
      
      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(tenant.id);
    });
  });
});
