import { Router, Request, Response } from 'express';
import { SubscriptionTier } from '@shared/types/index.js';
import { generateId } from '@shared/utils/index.js';
import { tiers } from './invoices.js';

const router = Router();

router.post('/create', (req: Request, res: Response) => {
  const { apiId, name, requestsPerMonth, rateLimitPerSecond, pricePerMonth, overagePricePerRequest } = req.body;
  
  const tier: SubscriptionTier = {
    id: generateId('tier'),
    apiId,
    name,
    requestsPerMonth,
    rateLimitPerSecond,
    pricePerMonth,
    overagePricePerRequest
  };
  
  tiers.set(tier.id, tier);
  res.status(201).json({ tier });
});

router.get('/:apiId', (req: Request, res: Response) => {
  const apiTiers = Array.from(tiers.values())
    .filter(t => t.apiId === req.params.apiId);
  res.json({ tiers: apiTiers });
});

export default router;
