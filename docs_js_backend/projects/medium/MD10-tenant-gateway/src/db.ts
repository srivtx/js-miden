import type { Tenant, ApiKey, UsageRecord } from '../types.js';

// In-memory store for testing/demo
export const tenants = new Map<string, Tenant>();
export const apiKeys = new Map<string, ApiKey>();
export const usageRecords = new Map<string, UsageRecord[]>();

export function resetDb() {
  tenants.clear();
  apiKeys.clear();
  usageRecords.clear();
}
