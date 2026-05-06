# v4 — Add Logging (Contact Form)

## The Scenario

It's 2am. Your junior gets paged: "Contact form is broken." They SSH into the server. The terminal is blank. "Where are the logs?" they ask. You explain that console output went to PM2's log file, which was rotated away 6 hours ago.

## The PAIN: Flying Blind

From v3:

```typescript
router.post('/contact', validateContact, (req, res) => {
  const body = (req as any).sanitizedBody;
  console.log('--- NEW CONTACT FORM SUBMISSION ---');
  console.log(`From: ${body.name} <${body.email}>`);
  console.log(`Message: ${body.message}`);
  console.log('-----------------------------------');
  res.json({ success: true });
});
```

### What breaks in production:

1. **Ephemeral logs**: Console output is lost on restart, container recreation, or log rotation.

2. **No aggregation**: 5 server instances → 5 separate console outputs. Finding a specific request means SSHing to each one.

3. **No severity levels**: A bot submission and a database connection error both look like plain text. You can't filter.

4. **PII in logs**: You're logging raw emails and messages. GDPR says you need to know what PII you retain. Console.log doesn't track retention.

5. **No error context**: When `validator.isEmail` throws on malformed input, you see a stack trace with no request body, no IP, no timestamp.

## The Solution: Structured Logging + GDPR Awareness

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['email', 'body.email', 'body.name', 'body.message'],
    remove: true, // Don't log PII in production
  },
});
```

```typescript
// routes/contact.ts
import { logger } from '../logger.js';

router.post('/contact', rateLimiter, validateContact, (req, res) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, ip: req.ip, route: 'POST /contact' });
  
  childLogger.info('Contact form submission received');
  
  try {
    const body = (req as any).sanitizedBody;
    
    // In production: send to email service, not console
    // For demo: log sanitized metadata only
    childLogger.info({
      emailHash: hashEmail(body.email), // One-way hash for analytics
      messageLength: body.message.length,
    }, 'Processing contact form');
    
    res.json({ success: true, message: 'Thank you!' });
  } catch (err) {
    childLogger.error({ err }, 'Contact form processing failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "requestId": "abc-123",
  "ip": "192.168.1.1",
  "route": "POST /contact",
  "emailHash": "a3f5c2...",
  "messageLength": 250,
  "msg": "Processing contact form"
}
```

### What structured logging gives you:

| Need | console.log | Structured logger |
|------|------------|-------------------|
| Persist logs | ❌ Lost on restart | ✓ Aggregator captures JSON |
| Filter by severity | ❌ All same | ✓ Error level filtering |
| Track spam patterns | ❌ Text grep | ✓ Query `emailHash` frequency |
| GDPR compliance | ❌ Raw PII everywhere | ✓ Redaction rules |
| Debug failures | ❌ No context | ✓ Request ID + IP + timestamp |

## The PAIN of Rate Limiter Failures

```typescript
// Without logging:
export async function rateLimiter(req, res, next) {
  try {
    const current = await redis.incr(key);
    if (current > RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  } catch (err) {
    console.error('Rate limiter error:', err);
    next(); // Fail open
  }
}
```

If Redis is down, you fail open (allow request). But do you know Redis is down? The error went to console and was lost. Users get through, but you're blind to infrastructure degradation.

## Logging Evolution in Contact Form

| Version | Logging | Observability |
|---------|---------|---------------|
| v1 (JS) | None | None |
| v2 (TS) | console.log | Ephemeral |
| v3 (Validation) | console.log | Same problems |
| v4 (Structured) | JSON, redacted, leveled | Full + GDPR-aware |

## The Realization

> Junior: "I set up Pino with redaction. Now logs show submission patterns without exposing emails. Compliance is happy."
> 
> You: "Contact forms are a GDPR nightmare by default. Every field is PII. Logging should answer 'how many submissions?' not 'what did they say?' Structure your logs for metrics, not voyeurism."

## The Next PAIN

Logs tell you what happened. But they don't prevent regressions. When you add rate limiting, how do you know it works? When you change validation, how do you know old valid inputs still pass?

## Next: v5 — Add Testing
