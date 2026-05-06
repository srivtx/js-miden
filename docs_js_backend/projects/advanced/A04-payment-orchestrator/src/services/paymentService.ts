/**
 * Payment Service - orchestrates payment processing with fallback and idempotency
 */

import { Payment, CreatePaymentRequest, PaymentStatus, ProviderType, PaymentAttempt } from '../types/index.js';
import { PaymentStore } from '../models/paymentStore.js';
import { PaymentProvider } from '../providers/base.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { CIRCUIT_BREAKER_CONFIG } from '../config/index.js';
import { randomUUID } from 'crypto';

export class PaymentService {
  private circuitBreakers: Map<ProviderType, CircuitBreaker> = new Map();

  constructor(
    private paymentStore: PaymentStore,
    private providers: PaymentProvider[],
    private primaryProvider: ProviderType = 'stripe'
  ) {
    for (const provider of providers) {
      this.circuitBreakers.set(
        provider.name,
        new CircuitBreaker(provider.name, CIRCUIT_BREAKER_CONFIG)
      );
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<{ payment: Payment; isNew: boolean }> {
    // Generate idempotency key if not provided
    const idempotencyKey = request.idempotencyKey || this.generateIdempotencyKey(request);

    // Check for existing payment with same idempotency key
    const existing = await this.paymentStore.getByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { payment: existing, isNew: false };
    }

    const payment: Payment = {
      id: randomUUID(),
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      status: 'pending',
      provider: null,
      providerTransactionId: null,
      idempotencyKey,
      customerEmail: request.customerEmail,
      metadata: request.metadata || {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    await this.paymentStore.save(payment);

    // Try primary provider first, then fallback
    const sortedProviders = this.sortProvidersByPriority();

    for (const provider of sortedProviders) {
      const cb = this.circuitBreakers.get(provider.name);
      if (!cb) continue;

      try {
        const result = await cb.execute(() =>
          provider.charge({
            amount: request.amount,
            currency: request.currency,
            description: request.description,
            idempotencyKey,
            customerEmail: request.customerEmail,
          })
        );

        const attempt: PaymentAttempt = {
          provider: provider.name,
          status: result.success ? 'success' : 'failed',
          errorMessage: result.error,
          timestamp: new Date(),
        };
        payment.attempts.push(attempt);

        if (result.success && result.transactionId) {
          payment.status = 'succeeded';
          payment.provider = provider.name;
          payment.providerTransactionId = result.transactionId;
          payment.updatedAt = new Date();
          await this.paymentStore.save(payment);
          return { payment, isNew: true };
        }
      } catch (error) {
        const attempt: PaymentAttempt = {
          provider: provider.name,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };
        payment.attempts.push(attempt);
      }
    }

    // All providers failed
    payment.status = 'failed';
    payment.updatedAt = new Date();
    await this.paymentStore.save(payment);
    return { payment, isNew: true };
  }

  async getPayment(id: string): Promise<Payment | null> {
    return (await this.paymentStore.getById(id)) || null;
  }

  async getPaymentsByStatus(status: PaymentStatus): Promise<Payment[]> {
    return this.paymentStore.getByStatus(status);
  }

  async refundPayment(id: string): Promise<Payment | null> {
    const payment = await this.paymentStore.getById(id);
    if (!payment || payment.status !== 'succeeded' || !payment.provider) {
      return null;
    }

    const provider = this.providers.find((p) => p.name === payment.provider);
    if (!provider) return null;

    const result = await provider.refund(payment.providerTransactionId!, payment.amount);

    if (result.success) {
      payment.status = 'refunded';
      payment.updatedAt = new Date();
      await this.paymentStore.save(payment);
    }

    return payment;
  }

  async updatePaymentStatusFromWebhook(
    provider: ProviderType,
    transactionId: string,
    status: PaymentStatus
  ): Promise<Payment | null> {
    // CRITICAL: Verify the payment belongs to this provider
    const payment = await this.paymentStore.getByProviderTransactionId(provider, transactionId);
    if (!payment) {
      return null;
    }

    // Extra safety check: ensure provider matches
    if (payment.provider !== provider) {
      console.error(`Provider mismatch: webhook from ${provider} for payment owned by ${payment.provider}`);
      return null;
    }

    payment.status = status;
    payment.updatedAt = new Date();
    await this.paymentStore.save(payment);
    return payment;
  }

  getProviderStatus(): Array<{
    provider: ProviderType;
    state: string;
    failureCount: number;
    successCount: number;
  }> {
    return Array.from(this.circuitBreakers.entries()).map(([provider, cb]) => ({
      provider,
      ...cb.getMetrics(),
    }));
  }

  private sortProvidersByPriority(): PaymentProvider[] {
    return [...this.providers].sort((a, b) => {
      if (a.name === this.primaryProvider) return -1;
      if (b.name === this.primaryProvider) return 1;
      return 0;
    });
  }

  private generateIdempotencyKey(request: CreatePaymentRequest): string {
    // Deterministic key based on request content
    const data = `${request.amount}:${request.currency}:${request.customerEmail}:${request.description}:${JSON.stringify(request.metadata || {})}`;
    return `key_${Buffer.from(data).toString('base64').slice(0, 32)}`;
  }
}
