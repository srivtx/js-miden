import { Router, Request, Response } from 'express';
import { ServiceClient } from '../../../../gateway/src/clients/service-client.js';

const router = Router();

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const BILLING_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:3003';

const authClient = new ServiceClient(AUTH_URL);
const billingClient = new ServiceClient(BILLING_URL);

interface Subscription {
  id: string;
  consumerId: string;
  apiId: string;
  tierId: string;
  apiKeyId: string;
  status: 'active' | 'cancelled';
  createdAt: Date;
}

const subscriptions = new Map<string, Subscription>();

router.post('/create', async (req: Request, res: Response) => {
  const { consumerId, apiId, tierId } = req.body;
  
  // Create API key via auth service
  const keyResult = await authClient.post('/keys/create', {
    developerId: consumerId,
    apiId,
    tierId
  }) as any;
  
  if (!keyResult.apiKey) {
    res.status(500).json({ error: 'Failed to create API key' });
    return;
  }
  
  const subscription: Subscription = {
    id: `sub_${Date.now()}`,
    consumerId,
    apiId,
    tierId,
    apiKeyId: keyResult.apiKey.id,
    status: 'active',
    createdAt: new Date()
  };
  
  subscriptions.set(subscription.id, subscription);
  
  res.status(201).json({
    subscription,
    apiKey: keyResult.key
  });
});

router.get('/consumer/:consumerId', (req: Request, res: Response) => {
  const consumerSubs = Array.from(subscriptions.values())
    .filter(s => s.consumerId === req.params.consumerId);
  res.json({ subscriptions: consumerSubs });
});

export { subscriptions };
export default router;
