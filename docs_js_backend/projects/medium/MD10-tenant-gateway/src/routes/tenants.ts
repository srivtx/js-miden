import { Router } from 'express';
import { tenants, apiKeys, usageRecords } from '../db.js';
import type { Tenant, ApiKey } from '../types.js';
import crypto from 'crypto';

const router = Router();

router.post('/', (req, res) => {
  const { name, subdomain } = req.body;
  const id = crypto.randomUUID();
  const tenant: Tenant = {
    id,
    name,
    subdomain,
    createdAt: new Date(),
    features: {},
  };
  tenants.set(id, tenant);
  res.status(201).json({ id, name, subdomain });
});

router.post('/:id/keys', (req, res) => {
  const tenantId = req.params.id;
  const tenant = tenants.get(tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  
  const keyId = crypto.randomUUID();
  const rawKey = `tk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  const apiKey: ApiKey = {
    id: keyId,
    tenantId,
    keyHash,
    name: req.body.name || 'default',
    createdAt: new Date(),
    lastUsedAt: null,
  };
  apiKeys.set(keyId, apiKey);
  res.status(201).json({ id: keyId, key: rawKey, name: apiKey.name });
});

router.get('/:id/usage', (req, res) => {
  const tenantId = req.params.id;
  const records = usageRecords.get(tenantId) || [];
  res.json({ tenantId, totalRequests: records.length, records });
});

export { router as tenantsRouter };
