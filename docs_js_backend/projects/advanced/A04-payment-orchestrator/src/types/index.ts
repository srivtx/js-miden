/**
 * Payment and provider types
 */

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type ProviderType = 'stripe' | 'paypal';

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  provider: ProviderType | null;
  providerTransactionId: string | null;
  idempotencyKey: string;
  customerEmail: string;
  metadata: Record<string, string>;
  attempts: PaymentAttempt[];
  createdAt: Date;
  updatedAt: Date;
  reconciledAt: Date | null;
}

export interface PaymentAttempt {
  provider: ProviderType;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: Date;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface ProviderChargeRequest {
  amount: number;
  currency: string;
  description: string;
  idempotencyKey: string;
  customerEmail: string;
}

export interface ProviderChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface WebhookPayload {
  provider: ProviderType;
  eventType: string;
  transactionId: string;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
}

export interface ReconciliationReport {
  date: string;
  totalPayments: number;
  matched: number;
  unmatched: number;
  discrepancies: Array<{
    paymentId: string;
    expectedStatus: PaymentStatus;
    actualStatus: PaymentStatus;
    provider: ProviderType;
  }>;
}
