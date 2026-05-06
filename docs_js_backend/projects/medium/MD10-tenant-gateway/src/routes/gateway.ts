import { Router } from 'express';
import { tenants, apiKeys, usageRecords } from '../db.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import type { UsageRecord } from '../types.js';
import crypto from 'crypto';

const router = Router();

// BUG: Tenant from spoofable header, not validated against API key
router.use(rateLimitMiddleware);

router.use((req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  const tenantIdHeader = req.headers['x-tenant-id'] as string;
  
  if (!apiKeyHeader || !tenantIdHeader) {
    res.status(401).json({ error: 'Missing API key or tenant ID' });
    return;
  }
  
  // BUG: We validate the API key exists but DON'T verify it belongs to this tenant
  const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
  const keyRecord = Array.from(apiKeys.values()).find(k => k.keyHash === keyHash);
  
  if (!keyRecord) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  
  // BUG: We use the tenant ID from the header without validating it matches the API key
  const tenantId = tenantIdHeader;
  const tenant = tenants.get(tenantId);
  
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  
  // Record usage
  const record: UsageRecord = {
    id: crypto.randomUUID(),
    tenantId,
    endpoint: req.path,
    timestamp: new Date(),
    statusCode: 200,
  };
  const records = usageRecords.get(tenantId) || [];
  records.push(record);
  usageRecords.set(tenantId, records);
  
  (req as any).tenantId = tenantId;
  next();
});

router.all('/*', (req, res) => {
  const tenantId = (req as any).tenantId;
  res.json({
    message: 'Request proxied',
    tenantId,
    path: req.path,
    method: req.method,
  });
});

export { router as gatewayRouter };
