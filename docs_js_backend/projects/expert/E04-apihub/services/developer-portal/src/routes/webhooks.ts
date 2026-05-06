import { Router, Request, Response } from 'express';
import { WebhookConfig } from '@shared/types/index.js';
import { generateId } from '@shared/utils/index.js';
import crypto from 'crypto';

const router = Router();

const webhooks = new Map<string, WebhookConfig>();

router.post('/register', (req: Request, res: Response) => {
  const { developerId, apiId, url, events } = req.body;
  
  const webhook: WebhookConfig = {
    id: generateId('wh'),
    developerId,
    apiId,
    url,
    events,
    secret: crypto.randomBytes(32).toString('hex'),
    active: true
  };
  
  webhooks.set(webhook.id, webhook);
  res.status(201).json({ webhook });
});

router.post('/:webhookId/trigger', async (req: Request, res: Response) => {
  const webhook = webhooks.get(req.params.webhookId);
  if (!webhook || !webhook.active) {
    res.status(404).json({ error: 'Webhook not found or inactive' });
    return;
  }
  
  const { event, payload } = req.body;
  
  if (!webhook.events.includes(event)) {
    res.status(400).json({ error: 'Event not subscribed' });
    return;
  }
  
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  // In production, this would actually POST to webhook.url
  res.json({
    triggered: true,
    webhookId: webhook.id,
    event,
    signature,
    wouldSendTo: webhook.url
  });
});

router.get('/developer/:developerId', (req: Request, res: Response) => {
  const developerWebhooks = Array.from(webhooks.values())
    .filter(w => w.developerId === req.params.developerId);
  res.json({ webhooks: developerWebhooks });
});

export { webhooks };
export default router;
