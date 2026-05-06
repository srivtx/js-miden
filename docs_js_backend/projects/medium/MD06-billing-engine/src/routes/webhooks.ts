import { Router, Request, Response } from 'express';
import { subscriptionService } from '../services/subscriptionService.js';

const router = Router();

// BUG 1: No webhook signature verification
// Processes request body directly without verifying Stripe signature
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    // VULNERABILITY: Should verify signature like this:
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    // Instead, we just parse the body directly - anyone can send fake events
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const result = await subscriptionService.handleWebhookEvent(event);
    res.json(result);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
