import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { PaymentController } from './controllers/paymentController.js';
import { WebhookController, ReconciliationController } from './controllers/webhookController.js';
import { PaymentService } from './services/paymentService.js';
import { ReconciliationService } from './services/reconciliationService.js';
import { PaymentStore } from './models/paymentStore.js';
import { StripeProvider } from './providers/stripe.js';
import { PayPalProvider } from './providers/paypal.js';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { validateCreatePayment, validateWebhook } from './middleware/validation.js';
import { paymentRateLimit, webhookRateLimit } from './middleware/rateLimit.js';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '1mb' }));

  // Raw body for webhook signature verification
  app.use('/webhooks', express.raw({ type: 'application/json' }));

  // Dependencies
  const paymentStore = new PaymentStore();
  const stripeProvider = new StripeProvider();
  const paypalProvider = new PayPalProvider();
  const providers = [stripeProvider, paypalProvider];
  const paymentService = new PaymentService(
    paymentStore,
    providers,
    config.PRIMARY_PROVIDER
  );
  const reconciliationService = new ReconciliationService(paymentStore, providers);
  const paymentController = new PaymentController(paymentService);
  const webhookController = new WebhookController(paymentService, reconciliationService);
  const reconciliationController = new ReconciliationController(reconciliationService);

  // Store providers on app for test access
  (app as any).providers = providers;
  (app as any).paymentStore = paymentStore;
  (app as any).paymentService = paymentService;

  // Routes
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Payment routes
  app.post('/payments', paymentRateLimit, validateCreatePayment, paymentController.createPayment);
  app.get('/payments/:id', paymentController.getPayment);
  app.get('/payments/status/:status', paymentController.getPaymentsByStatus);
  app.post('/payments/:id/refund', paymentRateLimit, paymentController.refundPayment);
  app.get('/providers/status', paymentController.getProviderStatus);

  // Webhook routes
  app.post('/webhooks/stripe', webhookRateLimit, validateWebhook, webhookController.handleStripeWebhook);
  app.post('/webhooks/paypal', webhookRateLimit, validateWebhook, webhookController.handlePayPalWebhook);

  // Reconciliation routes
  app.post('/reconcile', reconciliationController.reconcile);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
