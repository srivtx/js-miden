# MD03 URL Shortener Pro — v4 Adding Logging

## The Incident

Marketing reports: "The campaign link is broken." You check. The short URL redirects to a 404. The long URL was changed by the target site. But you have no record of when it last worked.

Then security reports: "Someone is using our shortener for phishing." You check the database. The malicious link was created 3 days ago. It got 50,000 clicks before anyone noticed. You have no click logs. You can't identify victims.

## The Fix: Structured Logging + Analytics Pipeline

```ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Click event logger
export function logClickEvent(
  code: string,
  longUrl: string,
  ip: string,
  userAgent: string,
  referrer: string | undefined,
  country: string | undefined,
  durationMs: number
) {
  logger.info({
    event: 'url_click',
    code,
    longUrl,
    ip: hashIp(ip), // privacy: hash the IP
    userAgent,
    referrer,
    country,
    durationMs,
    timestamp: new Date().toISOString(),
  });
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT).digest('hex').slice(0, 16);
}
```

### Logging Every Redirect

```ts
app.get('/:code', async (req, res) => {
  const start = Date.now();
  const { code } = req.params;

  try {
    const shortUrl = await db.query('SELECT * FROM short_urls WHERE code = $1', [code]);
    if (!shortUrl.rows[0]) {
      logger.warn({ event: 'url_not_found', code, ip: req.ip });
      return res.status(404).send('Not found');
    }

    const row = shortUrl.rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      logger.info({ event: 'url_expired', code, expiredAt: row.expires_at });
      return res.status(410).send('Gone');
    }

    // Async click logging (don't block redirect)
    const clickData = {
      code,
      longUrl: row.long_url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer,
      country: req.headers['cf-ipcountry'],
      durationMs: Date.now() - start,
    };

    // Fire and forget to analytics queue
    analyticsQueue.add(clickData).catch(err => {
      logger.error({ event: 'analytics_queue_error', error: err.message });
    });

    logClickEvent(clickData.code, clickData.longUrl, clickData.ip, clickData.userAgent || '', clickData.referrer, clickData.country, clickData.durationMs);

    res.redirect(302, row.long_url);
  } catch (err) {
    logger.error({ event: 'redirect_error', code, error: (err as Error).message });
    res.status(500).send('Internal error');
  }
});
```

### Abuse Detection

```ts
// Background job checks for suspicious patterns
async function detectAbuse() {
  const suspicious = await db.query(`
    SELECT code, COUNT(*) as clicks, COUNT(DISTINCT ip_hash) as unique_ips
    FROM click_logs
    WHERE timestamp > NOW() - INTERVAL '1 hour'
    GROUP BY code
    HAVING COUNT(*) > 1000 AND COUNT(DISTINCT ip_hash) < 10
  `);

  for (const row of suspicious.rows) {
    logger.warn({
      event: 'suspicious_activity_detected',
      code: row.code,
      clicks: row.clicks,
      uniqueIps: row.unique_ips,
      action: 'flagged_for_review',
    });
  }
}
```

## Observability: What to Log

| Event | Why |
|-------|-----|
| `url_click` | Track every redirect |
| `url_not_found` | Detect broken links |
| `url_expired` | Track TTL effectiveness |
| `shorten_attempt` | Audit link creation |
| `suspicious_activity_detected` | Security monitoring |
| `redirect_error` | Infrastructure health |

## The Dashboard Query

```sql
-- Top performing links today
SELECT code, COUNT(*) as clicks, COUNT(DISTINCT ip_hash) as unique_visitors
FROM click_logs
WHERE timestamp > CURRENT_DATE
GROUP BY code
ORDER BY clicks DESC
LIMIT 10;
```

## The Bug

You log every click synchronously. At 10,000 clicks per second, your logging blocks the event loop. Redirect latency jumps from 2ms to 500ms.

**Fix:** Use a background queue (Redis/Bull) for analytics. The redirect happens immediately. Analytics are batched and written asynchronously.

**Next:** Let's write tests so we can validate rate limiting and collision handling.
