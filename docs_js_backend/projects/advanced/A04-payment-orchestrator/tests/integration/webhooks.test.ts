import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';
import { StripeProvider } from '../../src/providers/stripe.js';
import { PayPalProvider } from '../../src/providers/paypal.js';

describe('Webhook API Integration', () => {
  let app: Application;
  let stripeProvider: StripeProvider;
  let paypalProvider: PayPalProvider;

  beforeAll(() => {
    app = createApp();
    stripeProvider = (app as any).providers[0];
    paypalProvider = (app as any).providers[1];
  });

  it('should handle Stripe webhook and update payment status', async () => {
    // Create a payment first
    const paymentResponse = await request(app)
      .post('/payments')
      .send({
        amount: 100,
        currency: 'USD',
        description: 'Webhook test',
        customerEmail: 'webhook@example.com',
      });

    const paymentId = paymentResponse.body.id;
    const transactionId = paymentResponse.body.providerTransactionId;

    // Send webhook
    const response = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', `stripe_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
      .send({
        provider: 'stripe',
        eventType: 'payment.succeeded',
        transactionId,
        status: 'succeeded',
        metadata: {},
      })
      .expect(200);

    expect(response.body.received).toBe(true);
    expect(response.body.paymentId).toBe(paymentId);
  });

  it('should handle PayPal webhook and update payment status', async () => {
    // Force Stripe to fail so PayPal is used
    stripeProvider.setFailureRate(1.0);

    const paymentResponse = await request(app)
      .post('/payments')
      .send({
        amount: 100,
        currency: 'USD',
        description: 'PayPal webhook test',
        customerEmail: 'paypal@example.com',
      });

    stripeProvider.setFailureRate(0);

    const paymentId = paymentResponse.body.id;
    const transactionId = paymentResponse.body.providerTransactionId;

    const response = await request(app)
      .post('/webhooks/paypal')
      .set('paypal-signature', `paypal_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
      .send({
        provider: 'paypal',
        eventType: 'payment.completed',
        transactionId,
        status: 'succeeded',
        metadata: {},
      })
      .expect(200);

    expect(response.body.received).toBe(true);
    expect(response.body.paymentId).toBe(paymentId);
  });

  it('should reject webhook with missing signature', async () => {
    await request(app)
      .post('/webhooks/stripe')
      .send({
        provider: 'stripe',
        eventType: 'payment.succeeded',
        transactionId: 'txn_123',
        status: 'succeeded',
      })
      .expect(400);
  });

  it('should reject webhook for non-existent transaction', async () => {
    await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', `stripe_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
      .send({
        provider: 'stripe',
        eventType: 'payment.succeeded',
        transactionId: 'nonexistent_txn',
        status: 'succeeded',
        metadata: {},
      })
      .expect(404);
  });
});
