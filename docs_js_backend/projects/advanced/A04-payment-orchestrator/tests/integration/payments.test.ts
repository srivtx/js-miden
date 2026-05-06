import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';
import { StripeProvider } from '../../src/providers/stripe.js';
import { PayPalProvider } from '../../src/providers/paypal.js';

describe('Payment API Integration', () => {
  let app: Application;
  let stripeProvider: StripeProvider;
  let paypalProvider: PayPalProvider;

  beforeAll(() => {
    app = createApp();
    stripeProvider = (app as any).providers[0];
    paypalProvider = (app as any).providers[1];
  });

  it('should create a payment successfully', async () => {
    const response = await request(app)
      .post('/payments')
      .send({
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        customerEmail: 'customer@example.com',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe('succeeded');
    expect(response.body.provider).toBeDefined();
    expect(response.body.providerTransactionId).toBeDefined();
  });

  it('should reject invalid payment requests', async () => {
    await request(app)
      .post('/payments')
      .send({
        amount: -100,
        currency: 'USD',
        description: 'Test',
        customerEmail: 'customer@example.com',
      })
      .expect(400);
  });

  it('should retrieve a payment by id', async () => {
    const createResponse = await request(app)
      .post('/payments')
      .send({
        amount: 50,
        currency: 'EUR',
        description: 'Retrieve test',
        customerEmail: 'test@example.com',
      });

    const id = createResponse.body.id;

    const response = await request(app)
      .get(`/payments/${id}`)
      .expect(200);

    expect(response.body.id).toBe(id);
    expect(response.body.amount).toBe(50);
  });

  it('should return 404 for non-existent payment', async () => {
    await request(app)
      .get('/payments/nonexistent-id')
      .expect(404);
  });

  it('should fallback to secondary provider when primary fails', async () => {
    // Force primary provider to fail
    stripeProvider.setFailureRate(1.0);

    const response = await request(app)
      .post('/payments')
      .send({
        amount: 75,
        currency: 'USD',
        description: 'Fallback test',
        customerEmail: 'fallback@example.com',
      })
      .expect(201);

    expect(response.body.status).toBe('succeeded');
    expect(response.body.provider).toBe('paypal'); // Fallback provider
    expect(response.body.attempts).toHaveLength(2);
    expect(response.body.attempts[0].status).toBe('failed');
    expect(response.body.attempts[1].status).toBe('success');

    // Reset failure rate
    stripeProvider.setFailureRate(0);
  });

  it('should mark payment as failed when all providers fail', async () => {
    stripeProvider.setFailureRate(1.0);
    paypalProvider.setFailureRate(1.0);

    const response = await request(app)
      .post('/payments')
      .send({
        amount: 100,
        currency: 'USD',
        description: 'All fail test',
        customerEmail: 'fail@example.com',
      })
      .expect(200);

    expect(response.body.status).toBe('failed');
    expect(response.body.attempts).toHaveLength(2);

    stripeProvider.setFailureRate(0);
    paypalProvider.setFailureRate(0);
  });

  it('should handle idempotency - duplicate requests return same payment', async () => {
    const requestBody = {
      amount: 200,
      currency: 'USD',
      description: 'Idempotency test',
      customerEmail: 'idempotent@example.com',
      idempotencyKey: 'unique-key-123',
    };

    const response1 = await request(app)
      .post('/payments')
      .send(requestBody)
      .expect(201);

    const response2 = await request(app)
      .post('/payments')
      .send(requestBody)
      .expect(200); // Should return existing, not 201

    expect(response1.body.id).toBe(response2.body.id);
    expect(response2.body.attempts.length).toBe(response1.body.attempts.length);
  });

  it('should refund a payment', async () => {
    const createResponse = await request(app)
      .post('/payments')
      .send({
        amount: 100,
        currency: 'USD',
        description: 'Refund test',
        customerEmail: 'refund@example.com',
      });

    const id = createResponse.body.id;

    const response = await request(app)
      .post(`/payments/${id}/refund`)
      .expect(200);

    expect(response.body.status).toBe('refunded');
  });

  it('should get payments by status', async () => {
    const response = await request(app)
      .get('/payments/status/succeeded')
      .expect(200);

    expect(response.body.payments).toBeInstanceOf(Array);
    expect(response.body.total).toBeDefined();
  });

  it('should return provider status', async () => {
    const response = await request(app)
      .get('/providers/status')
      .expect(200);

    expect(response.body.providers).toBeInstanceOf(Array);
    expect(response.body.providers.length).toBe(2);
  });
});
