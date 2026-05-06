import { createHash, randomBytes } from 'crypto';

export function generateApiKey(): string {
  return `apkh_${randomBytes(32).toString('hex')}`;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidTierHeader(tier: string): boolean {
  return ['free', 'basic', 'pro', 'enterprise'].includes(tier);
}
