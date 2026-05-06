import { Router, Request, Response } from 'express';
import { UsageRecord, UsageAggregate } from '@shared/types/index.js';
import { generateId } from '@shared/utils/index.js';

const router = Router();

const usageRecords: UsageRecord[] = [];
const aggregates = new Map<string, UsageAggregate>();

router.post('/', async (req: Request, res: Response) => {
  const { apiKeyId, apiId, developerId, endpoint, method, statusCode, responseTimeMs } = req.body;
  
  const record: UsageRecord = {
    id: generateId('usage'),
    apiKeyId,
    apiId,
    developerId,
    endpoint,
    method,
    statusCode,
    responseTimeMs,
    timestamp: new Date()
  };
  
  usageRecords.push(record);
  
  // BUG: Non-atomic read-modify-write
  // Under concurrent requests, two threads can read the same value,
  // both increment, and both write back, causing double-counting (lost updates)
  const now = new Date();
  const aggregateKey = `${apiKeyId}:${apiId}:${now.getFullYear()}-${now.getMonth() + 1}`;
  
  let aggregate = aggregates.get(aggregateKey);
  if (!aggregate) {
    aggregate = {
      apiKeyId,
      apiId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      totalRequests: 0,
      totalResponseTimeMs: 0,
      errorCount: 0
    };
    aggregates.set(aggregateKey, aggregate);
  }
  
  // This is the vulnerable operation - not atomic!
  aggregate.totalRequests += 1;
  aggregate.totalResponseTimeMs += responseTimeMs;
  if (statusCode >= 400) {
    aggregate.errorCount += 1;
  }
  
  res.status(201).json({ recorded: true, recordId: record.id });
});

router.get('/aggregate/:apiKeyId', (req: Request, res: Response) => {
  const { apiKeyId } = req.params;
  const apiId = req.query.apiId as string;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
  
  const aggregateKey = `${apiKeyId}:${apiId || '*'}:${year}-${month}`;
  
  if (apiId) {
    const aggregate = aggregates.get(aggregateKey);
    res.json({ aggregate: aggregate || null });
  } else {
    const results = Array.from(aggregates.values())
      .filter(a => a.apiKeyId === apiKeyId && a.year === year && a.month === month);
    res.json({ aggregates: results });
  }
});

router.get('/records/:apiKeyId', (req: Request, res: Response) => {
  const { apiKeyId } = req.params;
  const records = usageRecords.filter(r => r.apiKeyId === apiKeyId);
  res.json({ records });
});

export { usageRecords, aggregates };
export default router;
