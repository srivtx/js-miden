# MD03: Analytics Aggregation

## The Analytics Data Model

Every redirect generates an analytics event. A raw event looks like:

```json
{
  "short_code": "abc123",
  "timestamp": "2024-06-01T12:34:56Z",
  "ip_address": "203.0.113.42",
  "country": "US",
  "city": "San Francisco",
  "user_agent": "Mozilla/5.0 ...",
  "device": "mobile",
  "browser": "Chrome",
  "os": "iOS",
  "referrer": "https://twitter.com/...",
  "referrer_domain": "twitter.com"
}
```

Storing every raw event is infeasible at scale (100K events/sec = 8.6 billion/day = terabytes). We must **aggregate**.

## Aggregation Strategy: Time Buckets

Roll up events into time-based buckets:

```sql
CREATE TABLE click_stats_hourly (
    short_code VARCHAR(20) NOT NULL,
    hour TIMESTAMPTZ NOT NULL,
    total_clicks INT DEFAULT 0,
    unique_clicks INT DEFAULT 0,  -- from HyperLogLog
    mobile_clicks INT DEFAULT 0,
    desktop_clicks INT DEFAULT 0,
    top_referrer VARCHAR(255),
    top_country VARCHAR(2),
    PRIMARY KEY (short_code, hour)
);
```

Aggregation pipeline:
```
Raw Events (Kafka) → Stream Processor (Flink) → Hourly Rollups → ClickHouse
```

## Real-Time vs. Batch Analytics

| Dimension | Real-Time | Batch |
|-----------|-----------|-------|
| Latency | < 5 seconds | Hours |
| Use Case | Live dashboards, alerts | Reports, invoicing |
| Storage | Redis, in-memory | ClickHouse, BigQuery |
| Accuracy | Approximate (sampling) | Exact |

### Real-Time with Redis

```javascript
// Increment counters in real-time
await redis.hincrby(`stats:abc123:${hour}`, 'total', 1);
await redis.hincrby(`stats:abc123:${hour}`, 'country:US', 1);
await redis.hincrby(`stats:abc123:${hour}`, 'device:mobile', 1);

// Dashboard reads from Redis
const stats = await redis.hgetall(`stats:abc123:2024-06-01-12`);
```

### Batch with ClickHouse

ClickHouse is a columnar OLAP database optimized for analytics:

```sql
-- ClickHouse table for raw events (stored for 7 days, then dropped)
CREATE TABLE click_events (
    short_code String,
    timestamp DateTime,
    ip_address IPv4,
    country LowCardinality(String),
    device LowCardinality(String),
    referrer_domain String
) ENGINE = MergeTree()
ORDER BY (short_code, timestamp);

-- Materialized view for hourly aggregation
CREATE MATERIALIZED VIEW click_stats_hourly_mv
ENGINE = SummingMergeTree()
ORDER BY (short_code, hour)
AS SELECT
    short_code,
    toStartOfHour(timestamp) as hour,
    count() as total_clicks,
    uniqExact(ip_address) as unique_clicks
FROM click_events
GROUP BY short_code, hour;
```

## GeoIP Lookup

IP addresses must be mapped to locations. Use **MaxMind GeoIP2**:

```javascript
const geoip = require('geoip-lite');

function enrichEvent(ip) {
    const geo = geoip.lookup(ip);
    return {
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        timezone: geo?.timezone || 'UTC'
    };
}
```

This lookup is fast enough for the redirect hot path if cached, but better done asynchronously in the analytics pipeline.

## Referrer Parsing

Extract the domain from referrer URLs for tracking traffic sources:

```javascript
function getReferrerDomain(referrer) {
    try {
        return new URL(referrer).hostname.replace('www.', '');
    } catch {
        return 'direct';
    }
}

// Group by referrer domain
// twitter.com: 45%
// facebook.com: 30%
// direct: 25%
```

## Device Detection

Parse User-Agent strings to classify devices:

```javascript
const { UAParser } = require('ua-parser-js');

function parseDevice(userAgent) {
    const parser = new UAParser(userAgent);
    return {
        device: parser.getDevice().type || 'desktop', // mobile, tablet, desktop
        browser: parser.getBrowser().name,
        os: parser.getOS().name
    };
}
```

## Dashboard Queries

```sql
-- Top links today
SELECT short_code, SUM(total_clicks) as clicks
FROM click_stats_hourly
WHERE hour >= today()
GROUP BY short_code
ORDER BY clicks DESC
LIMIT 10;

-- Clicks over time for a specific link
SELECT hour, total_clicks, unique_clicks
FROM click_stats_hourly
WHERE short_code = 'abc123'
  AND hour >= now() - INTERVAL 7 DAY
ORDER BY hour;

-- Geographic distribution
SELECT country, SUM(total_clicks) as clicks
FROM click_stats_hourly
WHERE short_code = 'abc123'
GROUP BY country
ORDER BY clicks DESC;
```

## Sampling for High-Volume Links

For viral links with millions of clicks, raw aggregation is expensive. Use **sampling**:

```sql
-- ClickHouse: SAMPLE 1/100
SELECT short_code, count() * 100 as estimated_clicks
FROM click_events
WHERE short_code = 'viral-link'
SAMPLE 1/100;
```

This trades exactness for performance, acceptable for dashboard visualizations.

## Key Insight

> "Analytics is not a byproduct of a URL shortener. It is the primary value proposition. bit.ly's success came from showing users *where* their traffic came from, not just shortening URLs." — Product Analytics Philosophy

The technical challenge is separating the **fast redirect path** (cache, no analytics delay) from the **rich analytics path** (async, aggregated, eventually consistent).
