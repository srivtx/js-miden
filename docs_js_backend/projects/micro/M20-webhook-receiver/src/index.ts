import express, { Request, Response } from 'express';
import { verifyWebhook, processEventAsync, getEvents, isValidProvider } from './webhook.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Use raw body for signature verification
app.use(express.raw({ type: 'application/json', limit: '1mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    if (!isValidProvider(provider)) {
      res.status(400).json({ error: 'Unknown provider' });
      return;
    }

    const payload = req.body as Buffer;
    const headers = req.headers;

    // Verify signature before doing anything else
    const verified = verifyWebhook(provider, payload, headers);
    if (!verified.valid) {
      res.status(401).json({ error: 'Invalid signature', reason: verified.reason });
      return;
    }

    // Check timestamp for replay protection
    if (verified.tooOld) {
      res.status(401).json({ error: 'Webhook too old - possible replay attack' });
      return;
    }

    // Check idempotency
    if (verified.duplicate) {
      res.status(200).json({ success: true, message: 'Already processed' });
      return;
    }

    // Acknowledge immediately, process asynchronously
    const eventId = verified.eventId;
    processEventAsync(provider, eventId, payload, headers);

    res.status(202).json({
      success: true,
      provider,
      eventId,
      processed: false,
      queuedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/events', (_req: Request, res: Response) => {
  res.json({ events: getEvents() });
});

app.listen(PORT, () => {
  console.log(`M20 Webhook Receiver running on port ${PORT}`);
});

export default app;
