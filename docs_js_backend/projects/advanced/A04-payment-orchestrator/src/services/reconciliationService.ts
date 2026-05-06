/**
 * Reconciliation Service - compares internal payment records with provider records
 */

import { Payment, ReconciliationReport, PaymentStatus, ProviderType } from '../types/index.js';
import { PaymentStore } from '../models/paymentStore.js';
import { PaymentProvider } from '../providers/base.js';

export class ReconciliationService {
  constructor(
    private paymentStore: PaymentStore,
    private providers: PaymentProvider[]
  ) {}

  async reconcileDate(date: Date): Promise<ReconciliationReport> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await this.paymentStore.getByDateRange(startOfDay, endOfDay);
    const discrepancies: ReconciliationReport['discrepancies'] = [];
    let matched = 0;
    let unmatched = 0;

    for (const payment of payments) {
      if (!payment.provider || !payment.providerTransactionId) {
        unmatched++;
        continue;
      }

      const provider = this.providers.find((p) => p.name === payment.provider);
      if (!provider) {
        unmatched++;
        continue;
      }

      try {
        const providerStatus = await provider.getTransactionStatus(payment.providerTransactionId);

        if (this.statusesMatch(payment.status, providerStatus)) {
          matched++;
          payment.reconciledAt = new Date();
          await this.paymentStore.save(payment);
        } else {
          discrepancies.push({
            paymentId: payment.id,
            expectedStatus: payment.status,
            actualStatus: providerStatus,
            provider: payment.provider,
          });
          unmatched++;
        }
      } catch (error) {
        unmatched++;
        discrepancies.push({
          paymentId: payment.id,
          expectedStatus: payment.status,
          actualStatus: 'failed',
          provider: payment.provider,
        });
      }
    }

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalPayments: payments.length,
      matched,
      unmatched,
      discrepancies,
    };
  }

  private statusesMatch(internal: PaymentStatus, provider: PaymentStatus): boolean {
    // Map provider statuses to internal statuses
    const statusMap: Record<string, PaymentStatus> = {
      pending: 'pending',
      processing: 'processing',
      succeeded: 'succeeded',
      failed: 'failed',
      refunded: 'refunded',
      disputed: 'disputed',
    };

    return statusMap[provider] === internal;
  }
}
