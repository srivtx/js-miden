import { Router, Request, Response } from 'express';
import { aggregates } from './tracking.js';

const router = Router();

router.get('/:apiKeyId', (req: Request, res: Response) => {
  const { apiKeyId } = req.params;
  const apiId = req.query.apiId as string;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
  
  const aggregateKey = `${apiKeyId}:${apiId || '*'}:${year}-${month}`;
  const aggregate = aggregates.get(aggregateKey);
  
  if (!aggregate) {
    res.json({
      apiKeyId,
      apiId,
      used: 0,
      remaining: 1000,
      limit: 1000
    });
    return;
  }
  
  // BUG: Tier enforcement bypass - the client can send x-tier-header to override
  const requestedTier = req.headers['x-tier-override'] as string;
  let limit = 1000; // default
  
  if (requestedTier === 'premium') {
    limit = 100000;
  } else if (requestedTier === 'pro') {
    limit = 50000;
  } else if (requestedTier === 'basic') {
    limit = 10000;
  }
  
  res.json({
    apiKeyId,
    apiId,
    used: aggregate.totalRequests,
    remaining: Math.max(0, limit - aggregate.totalRequests),
    limit,
    tier: requestedTier || 'default'
  });
});

export default router;
