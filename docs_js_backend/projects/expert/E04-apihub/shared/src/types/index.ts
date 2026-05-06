export interface Developer {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ApiEndpoint {
  id: string;
  developerId: string;
  name: string;
  baseUrl: string;
  routes: ApiRoute[];
  createdAt: Date;
}

export interface ApiRoute {
  path: string;
  method: string;
  description: string;
}

export interface SubscriptionTier {
  id: string;
  apiId: string;
  name: string;
  requestsPerMonth: number;
  rateLimitPerSecond: number;
  pricePerMonth: number;
  overagePricePerRequest: number;
}

export interface ApiKey {
  id: string;
  key: string;
  developerId: string;
  apiId: string;
  tierId: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface UsageRecord {
  id: string;
  apiKeyId: string;
  apiId: string;
  developerId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
}

export interface UsageAggregate {
  apiKeyId: string;
  apiId: string;
  year: number;
  month: number;
  totalRequests: number;
  totalResponseTimeMs: number;
  errorCount: number;
}

export interface Invoice {
  id: string;
  apiKeyId: string;
  developerId: string;
  apiId: string;
  tierId: string;
  year: number;
  month: number;
  baseAmount: number;
  overageAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: Date;
}

export interface WebhookConfig {
  id: string;
  developerId: string;
  apiId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export interface GatewayRequest {
  apiKey: string;
  apiId: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface BillingTier {
  tierId: string;
  apiId: string;
  requestsIncluded: number;
  pricePerMonth: number;
  overagePrice: number;
}

export interface AnalyticsMetric {
  timestamp: Date;
  apiId: string;
  endpoint: string;
  requests: number;
  avgResponseTime: number;
  errorRate: number;
}
