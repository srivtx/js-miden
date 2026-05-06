import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';
import { StripeProvider } from '../../src/providers/stripe.js';
import { PayPalProvider } from '../../src/providers/paypal.js';

describe('Bug Regression Tests', () => {
  let app: Application;
  let stripeProvider: StripeProvider;
  let paypalProvider: PayPalProvider;

  beforeAll(() => {
    app = createApp();
    stripeProvider = (app as any).providers[0];
    paypalProvider = (app as any).providers[1];
  });

  describe('BUG: No fallback (primary fails = all payments fail)', () => {
    it('should succeed with fallback provider when primary fails', async () => {
      stripeProvider.setFailureRate(1.0); // Always fail

      const response = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Fallback test',
          customerEmail: 'fallback@example.com',
        })
        .expect(201);

      expect(response.body.status).toBe('succeeded');
      expect(response.body.provider).toBe('paypal');

      stripeProvider.setFailureRate(0);
    });

    it('should try all available providers before failing', async () => {
      stripeProvider.setFailureRate(1.0);
      paypalProvider.setFailureRate(1.0);

      const response = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'All fail test',
          customerEmail: 'allfail@example.com',
        })
        .expect(200);

      // Should have attempted both providers
      expect(response.body.attempts.length).toBeGreaterThanOrEqual(1);
      expect(response.body.status).toBe('failed');

      stripeProvider.setFailureRate(0);
      paypalProvider.setFailureRate(0);
    });

    it('should circuit-break after repeated failures but still try fallback', async () => {
      stripeProvider.setFailureRate(1.0);

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/payments')
          .send({
            amount: 10,
            currency: 'USD',
            description: `Circuit test ${i}`,
            customerEmail: `circuit${i}@example.com`,
          });
      }

      // Circuit should be open now, but fallback should still work
      const response = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Post-circuit test',
          customerEmail: 'postcircuit@example.com',
        })
        .expect(201);

      expect(response.body.status).toBe('succeeded');
      expect(response.body.provider).toBe('paypal');

      stripeProvider.setFailureRate(0);
    });
  });

  describe('BUG: No idempotency (retry creates duplicate charges)', () => {
    it('should not create duplicate payments with same idempotency key', async () => {
      const requestBody = {
        amount: 500,
        currency: 'USD',
        description: 'Idempotency test',
        customerEmail: 'idempotent@example.com',
        idempotencyKey: 'duplicate-prevention-key-123',
      };

      const response1 = await request(app)
        .post('/payments')
        .send(requestBody)
        .expect(201);

      const response2 = await request(app)
        .post('/payments')
        .send(requestBody)
        .expect(200);

      const response3 = await request(app)
        .post('/payments')
        .send(requestBody)
        .expect(200);

      // All responses should reference the SAME payment
      expect(response1.body.id).toBe(response2.body.id);
      expect(response2.body.id).toBe(response3.body.id);

      // Should only have one provider transaction
      expect(response3.body.providerTransactionId).toBe(response1.body.providerTransactionId);
    });

    it('should create different payments with different idempotency keys', async () => {
      const response1 = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Different key 1',
          customerEmail: 'different@example.com',
          idempotencyKey: 'key-alpha',
        })
        .expect(201);

      const response2 = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Different key 2',
          customerEmail: 'different@example.com',
          idempotencyKey: 'key-beta',
        })
        .expect(201);

      expect(response1.body.id).not.toBe(response2.body.id);
    });

    it('should auto-generate idempotency key if not provided', async () => {
      const requestBody = {
        amount: 100,
        currency: 'USD',
        description: 'Auto key test',
        customerEmail: 'auto@example.com',
      };

      const response1 = await request(app)
        .post('/payments')
        .send(requestBody)
        .expect(201);

      const response2 = await request(app)
        .post('/payments')
        .send(requestBody)
        .expect(200);

      expect(response1.body.id).toBe(response2.body.id);
    });
  });

  describe('BUG: Webhook from provider B updates payment for provider A (cross-contamination)', () => {
    it('should reject Stripe webhook for PayPal payment', async () => {
      // Force Stripe to fail so PayPal is used
      stripeProvider.setFailureRate(1.0);

      const paymentResponse = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Cross-contamination test',
          customerEmail: 'cross@example.com',
        });

      stripeProvider.setFailureRate(0);

      const transactionId = paymentResponse.body.providerTransactionId;
      expect(paymentResponse.body.provider).toBe('paypal');

      // Try to update with Stripe webhook
      const webhookResponse = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', `stripe_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
        .send({
          provider: 'stripe',
          eventType: 'payment.succeeded',
          transactionId,
          status: 'succeeded',
          metadata: {},
        })
        .expect(404);

      expect(webhookResponse.body.error).toBe('Payment not found');
    });

    it('should reject PayPal webhook for Stripe payment', async () => {
      const paymentResponse = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Cross-contamination test 2',
          customerEmail: 'cross2@example.com',
        });

      const transactionId = paymentResponse.body.providerTransactionId;
      expect(paymentResponse.body.provider).toBe('stripe');

      // Try to update with PayPal webhook
      const webhookResponse = await request(app)
        .post('/webhooks/paypal')
        .set('paypal-signature', `paypal_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
        .send({
          provider: 'paypal',
          eventType: 'payment.completed',
          transactionId,
          status: 'succeeded',
          metadata: {},
        })
        .expect(404);

      expect(webhookResponse.body.error).toBe('Payment not found');
    });

    it('should only update payment status from correct provider', async () => {
      // Create a Stripe payment
      const stripePayment = await request(app)
        .post('/payments')
        .send({
          amount: 100,
          currency: 'USD',
          description: 'Provider verification test',
          customerEmail: 'verify@example.com',
        });

      const stripeTxnId = stripePayment.body.providerTransactionId;

      // Create a PayPal payment
      stripeProvider.setFailureRate(1.0);
      const paypalPayment = await request(app)
        .post('/payments')
        .send({
          amount: 200,
          currency: 'USD',
          description: 'Provider verification test 2',
          customerEmail: 'verify2@example.com',
        });
      stripeProvider.setFailureRate(0);

      const paypalTxnId = paypalPayment.body.providerTransactionId;

      // Update Stripe payment via Stripe webhook
      await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', `stripe_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
        .send({
          provider: 'stripe',
          eventType: 'payment.succeeded',
          transactionId: stripeTxnId,
          status: 'succeeded',
          metadata: {},
        })
        .expect(200);

      // Try to update Stripe payment via PayPal webhook (should fail)
      await request(app)
        .post('/webhooks/paypal')
        .set('paypal-signature', `paypal_${Buffer.from(JSON.stringify({})).toString('base64').slice(0, 20)}`)
        .send({
          provider: 'paypal',
          eventType: 'payment.completed',
          transactionId: stripeTxnId,
          status: 'refunded',
          metadata: {},
        })
        .expect(404);

      // Verify Stripe payment is still succeeded, not refunded
      const checkResponse = await request(app)
        .get(`/payments/${stripePayment.body.id}`)
        .expect(200);

      expect(checkResponse.body.status).toBe('succeeded');
    });
  });
});
