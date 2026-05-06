import { Router, Request, Response } from 'express';
import { registerToken, sendPush, sendBatch, getDeliveryStatus, getTokens } from './service.js';

export const router = Router();

router.post('/tokens', async (req: Request, res: Response) => {
  try {
    const token = await registerToken(req.body);
    res.status(201).json(token);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/tokens', async (_req: Request, res: Response) => {
  res.json(getTokens());
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const notification = await sendPush(req.body);
    res.status(202).json(notification);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/send-batch', async (req: Request, res: Response) => {
  try {
    const result = await sendBatch(req.body);
    res.status(202).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/status/:id', async (req: Request, res: Response) => {
  const status = await getDeliveryStatus(req.params.id as string);
  if (!status) return res.status(404).json({ error: 'Not found' });
  res.json(status);
});
