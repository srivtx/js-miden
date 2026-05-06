export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  features: Record<string, boolean>;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  keyHash: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  endpoint: string;
  timestamp: Date;
  statusCode: number;
}

export interface GatewayRequest {
  tenantId: string;
  apiKey: string;
  path: string;
  method: string;
  timestamp: Date;
}
