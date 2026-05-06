import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/paymentService.js';
import { ReconciliationService } from '../services/reconciliationService.js';
import { ProviderType, WebhookPayload } from '../types/index.js';

export class WebhookController {
  constructor(
    private paymentService: PaymentService,
    private reconciliationService: ReconciliationService
  ) {}

  handleStripeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing signature', code: 'MISSING_SIGNATURE' });
        return;
      }

      const payload = req.body as WebhookPayload;

      // Verify webhook signature
      // In real implementation, use Stripe SDK to verify
      // For mock, we check the signature format

      if (payload.provider && payload.provider !== 'stripe') {
        res.status(400).json({ error: 'Invalid provider in webhook', code: 'INVALID_PROVIDER' });
        return;
      }

      const payment = await this.paymentService.updatePaymentStatusFromWebhook(
        'stripe',
        payload.transactionId,
        payload.status
      );

      if (!payment) {
        res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' });
        return;
      }

      res.json({ received: true, paymentId: payment.id });
    } catch (error) {
      next(error);
    }
  };

  handlePayPalWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['paypal-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing signature', code: 'MISSING_SIGNATURE' });
        return;
      }

      const payload = req.body as WebhookPayload;

      if (payload.provider && payload.provider !== 'paypal') {
        res.status(400).json({ error: 'Invalid provider in webhook', code: 'INVALID_PROVIDER' });
        return;
      }

      const payment = await this.paymentService.updatePaymentStatusFromWebhook(
        'paypal',
        payload.transactionId,
        payload.status
      );

      if (!payment) {
        res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' });
        return;
      }

      res.json({ received: true, paymentId: payment.id });
    } catch (error) {
      next(error);
    }
  };
}

export class ReconciliationController {
  constructor(private reconciliationService: ReconciliationService) {}

  reconcile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dateParam = req.query.date as string;
      const date = dateParam ? new Date(dateParam) : new Date();

      const report = await this.reconciliationService.reconcileDate(date);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };
}
