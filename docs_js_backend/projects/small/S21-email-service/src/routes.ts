import { Router, Request, Response } from 'express';
import { sendEmail, getQueueStatus, getEmailStatus, getTemplates, processQueue } from './service.js';

export const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  try {
    const email = await sendEmail(req.body);
    res.status(202).json({ id: email.id, status: email.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/queue', async (_req: Request, res: Response) => {
  const status = await getQueueStatus();
  res.json(status);
});

router.get('/status/:id', async (req: Request, res: Response) => {
  const email = await getEmailStatus(req.params.id as string);
  if (!email) return res.status(404).json({ error: 'Not found' });
  res.json(email);
});

router.get('/templates', async (_req: Request, res: Response) => {
  res.json(getTemplates());
});

router.post('/process-queue', async (_req: Request, res: Response) => {
  await processQueue();
  res.json({ message: 'Queue processed' });
});
