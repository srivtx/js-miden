import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('Billing Engine', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.webhookLog.deleteMany();
    await prisma.subscriptionEvent.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'test@billing.com', password: await bcrypt.hash('pass', 10), name: 'Test' },
    });
    userId = user.id;

    const login = await request(app).post('/api/auth/login').send({ email: 'test@billing.com', password: 'pass' });
    token = login.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('BUG: should accept fake webhook without signature verification', async () => {
    const fakeEvent = {
      id: 'evt_fake_123',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test',
          amount_paid: 5000,
          currency: 'usd',
          subscription: 'sub_test',
        },
      },
    };

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(fakeEvent);

    // Bug allows fake webhooks to be processed
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);
  });

  it('BUG: should process same payment twice without idempotency', async () => {
    // Create a subscription and invoice first
    const sub = await prisma.subscription.create({
      data: {
        userId,
        stripePriceId: 'price_test',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        plan: 'pro',
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        subscriptionId: sub.id,
        stripeInvoiceId: 'in_dup_test',
        amount: 5000,
        currency: 'usd',
        status: 'OPEN',
      },
    });

    const event = {
      id: 'evt_dup_1',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_dup_test',
          amount_paid: 5000,
          currency: 'usd',
          subscription: 'sub_test',
        },
      },
    };

    // Process first time
    await request(app).post('/webhooks/stripe').send(event);

    // Process second time with different event ID (simulates Stripe retry with different event ID)
    const event2 = { ...event, id: 'evt_dup_2' };
    const res2 = await request(app).post('/webhooks/stripe').send(event2);

    expect(res2.status).toBe(200);

    // Check that invoice was updated twice (no idempotency protection on payment)
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(updated?.status).toBe('PAID');
    // In a correct implementation, the second webhook would be rejected for this invoice
  });

  it('should list subscriptions', async () => {
    const res = await request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should list invoices', async () => {
    const res = await request(app).get('/api/invoices').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
