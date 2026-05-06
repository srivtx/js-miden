/**
 * In-memory payment storage with idempotency tracking
 */

import { Payment, PaymentStatus, ProviderType } from '../types/index.js';

export class PaymentStore {
  private payments: Map<string, Payment> = new Map();
  private idempotencyMap: Map<string, string> = new Map(); // idempotencyKey -> paymentId

  async save(payment: Payment): Promise<void> {
    this.payments.set(payment.id, payment);
    if (payment.idempotencyKey) {
      this.idempotencyMap.set(payment.idempotencyKey, payment.id);
    }
  }

  async getById(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getByIdempotencyKey(key: string): Promise<Payment | undefined> {
    const paymentId = this.idempotencyMap.get(key);
    if (!paymentId) return undefined;
    return this.payments.get(paymentId);
  }

  async getByProviderTransactionId(
    provider: ProviderType,
    transactionId: string
  ): Promise<Payment | undefined> {
    for (const payment of this.payments.values()) {
      if (payment.provider === provider && payment.providerTransactionId === transactionId) {
        return payment;
      }
    }
    return undefined;
  }

  async getAll(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async getByStatus(status: PaymentStatus): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.status === status);
  }

  async getByDateRange(start: Date, end: Date): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => {
      const createdAt = new Date(p.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }

  async delete(id: string): Promise<boolean> {
    const payment = this.payments.get(id);
    if (payment) {
      this.payments.delete(id);
      if (payment.idempotencyKey) {
        this.idempotencyMap.delete(payment.idempotencyKey);
      }
      return true;
    }
    return false;
  }

  async count(): Promise<number> {
    return this.payments.size;
  }
}
