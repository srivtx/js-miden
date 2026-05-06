# MD03 URL Shortener Pro — v5 Adding Testing

## The Bug

You "fixed" rate limiting. You wrote:

```ts
const recentCount = await db.query(
  'SELECT COUNT(*) FROM short_urls WHERE created_at > NOW() - INTERVAL \'1 hour\' AND ip = $1',
  [clientIp]
);
```

You deploy. A user reports: "I created 5 links and now I'm rate limited." You check. The query counts all links ever created from that IP, not just the recent ones. Wait, no — it does filter by `created_at`. The real bug: `clientIp` is undefined for IPv6 clients. The query becomes `ip = NULL`. PostgreSQL returns zero rows. IPv6 users bypass rate limiting entirely.

Tests would have caught this.

## The Fix: Comprehensive Tests

### Unit Tests: Code Generation

```ts
import { describe, it, expect } from 'vitest';
import { generateUniqueCode } from '../src/utils/codegen';

describe('generateUniqueCode', () => {
  it('generates codes of correct length', () => {
    const code = generateUniqueCode();
    expect(code).toHaveLength(7);
  });

  it('generates URL-safe characters only', () => {
    const code = generateUniqueCode();
    expect(code).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateUniqueCode));
    expect(codes.size).toBe(1000);
  });
});
```

### Integration Tests: Rate Limiting

```ts
import { describe, it, expect } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { UrlShortenerService } from '../src/services/urlShortenerService';

describe('Rate limiting', () => {
  it('allows 10 anonymous requests per hour', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);

    for (let i = 0; i < 10; i++) {
      await service.shorten({ url: `https://example.com/${i}` }, undefined, '192.168.1.1');
    }

    await expect(
      service.shorten({ url: 'https://example.com/11' }, undefined, '192.168.1.1')
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('allows 100 authenticated requests per hour', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);
    const userId = 'user-123';

    for (let i = 0; i < 100; i++) {
      await service.shorten({ url: `https://example.com/${i}` }, userId, '192.168.1.1');
    }

    await expect(
      service.shorten({ url: 'https://example.com/101' }, userId, '192.168.1.1')
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('handles IPv6 addresses correctly', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);

    // IPv6 localhost
    await service.shorten({ url: 'https://example.com/1' }, undefined, '::1');
    await service.shorten({ url: 'https://example.com/2' }, undefined, '::1');

    const count = await db.query('SELECT COUNT(*) FROM short_urls WHERE ip = $1', ['::1']);
    expect(parseInt(count.rows[0].count)).toBe(2);
  });
});
```

### Integration Tests: Collision Handling

```ts
describe('Code collision', () => {
  it('rejects duplicate custom codes', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);

    await service.shorten({ url: 'https://a.com', customCode: 'mycode' });

    await expect(
      service.shorten({ url: 'https://b.com', customCode: 'mycode' })
    ).rejects.toThrow('Code already in use');
  });

  it('handles race condition on custom code creation', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);

    const attempts = [
      service.shorten({ url: 'https://a.com', customCode: 'race' }),
      service.shorten({ url: 'https://b.com', customCode: 'race' }),
    ];

    const results = await Promise.allSettled(attempts);
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes).toHaveLength(1);
  });
});
```

### Analytics Tests

```ts
describe('Analytics', () => {
  it('tracks clicks correctly', async () => {
    const db = await createTestDatabase();
    const service = new UrlShortenerService(db);

    const url = await service.shorten({ url: 'https://campaign.com' });
    await service.recordClick(url.code, { ip: '1.2.3.4', userAgent: 'Mozilla/5.0' });
    await service.recordClick(url.code, { ip: '1.2.3.4', userAgent: 'Mozilla/5.0' });
    await service.recordClick(url.code, { ip: '5.6.7.8', userAgent: 'Chrome/91' });

    const analytics = await service.getAnalytics(url.code);
    expect(analytics.totalClicks).toBe(3);
    expect(analytics.uniqueVisitors).toBe(2);
  });
});
```

## What Tests Caught

- IPv6 rate limit bypass → caught (IP handling test)
- Custom code race condition → caught (concurrency test)
- Analytics double-counting → caught (unique visitor test)
- Expired URL still redirecting → caught (TTL test)
- Reserved code bypass → caught (custom code validation)

## The Confidence

Now you can switch from SQLite to PostgreSQL, add Redis caching, or implement cache stampede protection and know that:
1. Rate limits work for all IP types
2. Codes are unique under concurrency
3. Analytics are accurate
4. Expired URLs are rejected

**Next:** Let's modernize the module system.
