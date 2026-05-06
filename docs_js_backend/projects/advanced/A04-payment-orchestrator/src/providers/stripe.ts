import { PaymentProvider } from './base.js';
import { ProviderChargeRequest, ProviderChargeResult, PaymentStatus, ProviderType } from '../types/index.js';

/**
 * Mock Stripe Provider
 * Simulates Stripe payment processing with configurable failure rate
 */
export class StripeProvider implements PaymentProvider {
  readonly name: ProviderType = 'stripe';
  private failureRate: number = 0;
  private transactions: Map<string, { status: PaymentStatus; amount: number }> = new Map();

  setFailureRate(rate: number): void {
    this.failureRate = rate;
  }

  async charge(request: ProviderChargeRequest): Promise<ProviderChargeResult> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Stripe processing error: Card declined',
      };
    }

    const transactionId = `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.transactions.set(transactionId, { status: 'succeeded', amount: request.amount });

    return {
      success: true,
      transactionId,
    };
  }

  async refund(transactionId: string, _amount: number): Promise<ProviderChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    tx.status = 'refunded';
    return { success: true, transactionId };
  }

  async getTransactionStatus(transactionId: string): Promise<PaymentStatus> {
    const tx = this.transactions.get(transactionId);
    return tx?.status || 'failed';
  }

  verifyWebhook(payload: unknown, signature: string): boolean {
    // Verify webhook signature
    if (!signature.startsWith('stripe_')) {
      return false;
    }
    const expected = this.computeSignature(payload);
    return signature === expected;
  }

  private computeSignature(payload: unknown): string {
    // Simplified signature computation for mock
    return `stripe_${Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 20)}`;
  }
}
