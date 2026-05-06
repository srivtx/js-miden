import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { config } from '../config.js';
import { encodeBase62 } from '../utils/base62.js';
import { generateQRCodeMock } from '../utils/qrCode.js';

export async function getNextCounter(): Promise<bigint> {
  const counter = await prisma.counter.upsert({
    where: { id: 'global' },
    update: { value: { increment: 1 } },
    create: { id: 'global', value: 1 },
  });
  return counter.value;
}

export async function createShortUrl(originalUrl: string, customAlias?: string, userId?: string, expiresAt?: Date) {
  if (customAlias) {
    const existing = await prisma.url.findUnique({ where: { customAlias } });
    if (existing) {
      throw Object.assign(new Error('Custom alias already in use'), { statusCode: 409, code: 'ALIAS_EXISTS' });
    }
  }

  // Check for duplicate URL for same user
  if (userId) {
    const existing = await prisma.url.findFirst({ where: { originalUrl, userId } });
    if (existing) return existing;
  }

  const counter = await getNextCounter();
  const shortCode = customAlias || encodeBase62(counter);

  const url = await prisma.url.create({
    data: {
      originalUrl,
      shortCode,
      customAlias: customAlias || null,
      userId: userId || null,
      expiresAt: expiresAt || new Date(Date.now() + config.defaultExpiryDays * 24 * 60 * 60 * 1000),
    },
  });

  await redis.setEx(`url:${shortCode}`, config.cacheTtlSeconds, url.originalUrl);

  return {
    ...url,
    shortUrl: `${config.baseUrl}/${shortCode}`,
    qrCode: generateQRCodeMock(`${config.baseUrl}/${shortCode}`),
  };
}

export async function getOriginalUrl(shortCode: string): Promise<string | null> {
  // BUG: Cache stampede.
  // When cache expires, multiple concurrent requests will all hit the database
  // simultaneously because there is no lock or single-flight mechanism.
  // FIX: Use a cache-aside pattern with a mutex/lock (e.g., Redlock) or
  // implement a stale-while-revalidate or singleflight pattern.
  const cached = await redis.get(`url:${shortCode}`);
  if (cached) return cached;

  const url = await prisma.url.findUnique({ where: { shortCode } });
  if (!url || !url.isActive) return null;
  if (url.expiresAt && url.expiresAt < new Date()) return null;

  // Multiple concurrent requests can reach here simultaneously when cache expires
  await redis.setEx(`url:${shortCode}`, config.cacheTtlSeconds, url.originalUrl);

  return url.originalUrl;
}

export async function getUrlByShortCode(shortCode: string) {
  const url = await prisma.url.findUnique({ where: { shortCode } });
  if (!url) throw Object.assign(new Error('URL not found'), { statusCode: 404, code: 'NOT_FOUND' });
  return {
    ...url,
    shortUrl: `${config.baseUrl}/${shortCode}`,
  };
}

export async function getUrlsByUser(userId: string) {
  return prisma.url.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteUrl(shortCode: string, userId: string) {
  const url = await prisma.url.findFirst({ where: { shortCode, userId } });
  if (!url) throw Object.assign(new Error('URL not found'), { statusCode: 404, code: 'NOT_FOUND' });

  await prisma.url.update({ where: { id: url.id }, data: { isActive: false } });
  await redis.del(`url:${shortCode}`);
  return { success: true };
}
