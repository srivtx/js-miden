import { ProviderType, ProviderChargeRequest, ProviderChargeResult, PaymentStatus } from '../types/index.js';

export interface PaymentProvider {
  readonly name: ProviderType;
  charge(request: ProviderChargeRequest): Promise<ProviderChargeResult>;
  refund(transactionId: string, amount: number): Promise<ProviderChargeResult>;
  getTransactionStatus(transactionId: string): Promise<PaymentStatus>;
  verifyWebhook(payload: unknown, signature: string): boolean;
}
