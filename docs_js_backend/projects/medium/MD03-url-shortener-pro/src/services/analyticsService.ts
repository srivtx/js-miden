import { prisma } from '../db.js';
import { redis } from '../redis.js';

const ANALYTICS_BATCH_KEY = 'analytics:batch';

export interface ClickEventData {
  urlId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  city?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}

export async function trackClick(data: ClickEventData): Promise<void> {
  // Add to Redis list for batch processing
  await redis.lPush(ANALYTICS_BATCH_KEY, JSON.stringify(data));

  // Increment click counter on URL
  await prisma.url.update({
    where: { id: data.urlId },
    data: { clicks: { increment: 1 } },
  });
}

export async function flushAnalyticsBatch(batchSize: number = 100): Promise<number> {
  const events: string[] = [];
  for (let i = 0; i < batchSize; i++) {
    const event = await redis.rPop(ANALYTICS_BATCH_KEY);
    if (!event) break;
    events.push(event);
  }

  if (events.length === 0) return 0;

  const parsed = events.map((e) => JSON.parse(e) as ClickEventData);

  await prisma.clickEvent.createMany({
    data: parsed.map((p) => ({
      urlId: p.urlId,
      ipAddress: p.ipAddress,
      userAgent: p.userAgent,
      referrer: p.referrer,
      country: p.country,
      city: p.city,
      deviceType: p.deviceType,
      browser: p.browser,
      os: p.os,
    })),
    skipDuplicates: false,
  });

  return events.length;
}

export async function getUrlAnalytics(urlId: string) {
  const [totalClicks, clickEvents] = await Promise.all([
    prisma.clickEvent.count({ where: { urlId } }),
    prisma.clickEvent.findMany({
      where: { urlId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const countries = await prisma.clickEvent.groupBy({
    by: ['country'],
    where: { urlId },
    _count: { country: true },
  });

  const browsers = await prisma.clickEvent.groupBy({
    by: ['browser'],
    where: { urlId },
    _count: { browser: true },
  });

  return {
    totalClicks,
    recentEvents: clickEvents,
    breakdown: {
      countries: countries.map((c) => ({ name: c.country || 'Unknown', count: c._count.country })),
      browsers: browsers.map((b) => ({ name: b.browser || 'Unknown', count: b._count.browser })),
    },
  };
}

export async function getAdminStats() {
  const [totalUrls, totalClicks, totalEvents] = await Promise.all([
    prisma.url.count(),
    prisma.url.aggregate({ _sum: { clicks: true } }),
    prisma.clickEvent.count(),
  ]);

  const topUrls = await prisma.url.findMany({
    orderBy: { clicks: 'desc' },
    take: 10,
    select: {
      id: true,
      originalUrl: true,
      shortCode: true,
      clicks: true,
      createdAt: true,
    },
  });

  return {
    totalUrls,
    totalClicks: totalClicks._sum.clicks || 0,
    totalEvents,
    topUrls,
  };
}
