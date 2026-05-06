# v7 — Production Setup (Contact Form)

## The Scenario

It's 2am. Your junior deploys the contact form. "It validates and everything!" they say. Then the spam starts. 10,000 submissions in an hour. The Redis rate limiter exists, but it was never applied to the route. The logs show raw emails. There's no helmet. No error handler. The junior stares at the screen. "It worked in development..."

## The PAIN: Development != Production

From v6:

```typescript
router.post('/contact', validateContact, (req, res) => {
  // Rate limiter imported but NOT applied!
  // This is the actual production bug.
});
```

Local development:
- You test 1 submission
- Redis might not even be running
- Helmet seems unnecessary (it's just you)
- Error handler? Errors show in terminal

Production:
- Bots submit 10,000x/minute
- Every request needs security headers
- Errors must not leak to clients
- Rate limiting is the difference between service and DDoS

## The Solution: Production-Ready Contact Form

### 1. Security Headers (Helmet)

```typescript
// src/app.ts (actual production code)
import express from 'express';
import helmet from 'helmet';
import contactRouter from './routes/contact.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet()); // Sets 11 security headers automatically
// X-Content-Type-Options: nosniff
// X-Frame-Options: DENY
// Content-Security-Policy: ...
// And more. Without writing a single line.

app.use(express.json());
app.use('/', contactRouter);
app.use(errorHandler);

export default app;
```

### 2. Rate Limiting (Redis-Backed)

```typescript
// src/middleware/rateLimiter.ts (actual production code)
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { REDIS_URL, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from '../config.js';

const redis = new Redis(REDIS_URL);

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown';
  const key = `rate_limit:contact:${ip}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);
    }

    if (current > RATE_LIMIT_MAX) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      });
      return;
    }

    next();
  } catch (err) {
    console.error('Rate limiter error:', err);
    // Fail open: if Redis is down, allow request
    next();
  }
}
```

Why Redis?
- **Distributed**: Works across multiple server instances
- **Atomic**: `INCR` is atomic — no race conditions
- **TTL**: `PEXPIRE` auto-cleans old keys

### 3. Validation + Sanitization + Honeypot

```typescript
// src/middleware/validator.ts (actual production code)
import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

export function validateContact(req: Request, res: Response, next: NextFunction): void {
  const { name, email, message, website } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    return;
  }

  if (!email || !validator.isEmail(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 5000) {
    res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
    return;
  }

  // Honeypot: if website field is filled, silently reject (bot detected)
  if (website && typeof website === 'string' && website.trim().length > 0) {
    res.status(200).json({ success: true, message: 'Message received' });
    return;
  }

  // Sanitize for logging
  (req as any).sanitizedBody = {
    name: validator.escape(name.trim()),
    email: validator.normalizeEmail(email.trim()) as string,
    message: validator.escape(message.trim()),
  };

  next();
}
```

### 4. The BUG (Intentionally Documented)

```typescript
// src/routes/contact.ts
router.post('/contact', validateContact, (req, res) => {
  // BUG: Rate limiter middleware is imported but NOT applied to this route.
  // This leaves the endpoint vulnerable to spam.
  // The test 'BUG: allows more than 3 submissions' documents this.
  const body = (req as any).sanitizedBody || req.body;
  // ...
});
```

Fix:
```typescript
router.post('/contact', rateLimiter, validateContact, (req, res) => {
  // ...
});
```

### 5. Error Handler

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

Never leak stack traces to clients. Log them internally. Return generic messages.

### 6. Configuration

```typescript
// src/config.ts
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const PORT = process.env.PORT || 3000;
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Validation | None | Zod + custom + sanitization |
| Rate limiting | None | Redis-backed, distributed |
| Security headers | None | Helmet (11 headers) |
| Spam protection | None | Honeypot field |
| Error handling | None | Generic messages, logged details |
| Types | None | TypeScript |
| Tests | None | Vitest (documents rate limit bug) |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I added Helmet, validation, rate limiting, and error handling. The contact form went from 'log to console' to 'production-grade security endpoint.' And the bug in the route? The test caught it. I almost deployed without rate limiting applied."
> 
> You: "Contact forms are attack surfaces. Every public endpoint is. The layers we added — validation for data quality, rate limiting for abuse prevention, helmet for security headers, error handling for safety — they're not 'nice to haves.' They're the minimum viable security."

## Files in this project

```
S02-contact-form/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express + Helmet + error handler
│   ├── config.ts             # Environment config
│   ├── types.ts              # TypeScript interfaces
│   ├── routes/
│   │   └── contact.ts        # Route (BUG: no rate limiter applied)
│   └── middleware/
│       ├── validator.ts      # Validation + sanitization + honeypot
│       ├── rateLimiter.ts    # Redis-backed rate limiting
│       └── errorHandler.ts   # Safe error responses
├── tests/
│   └── contact.test.ts       # Vitest (documents bug)
├── package.json              # ESM
└── tsconfig.json
```

## What You Learned

1. **Defense in depth**: Validation + rate limiting + honeypot + helmet. No single layer is enough.
2. **Fail open vs fail closed**: Redis down → allow requests (fail open). Better than blocking legitimate users.
3. **GDPR awareness**: Don't log PII. Hash emails for analytics. Sanitize everything.
4. **Bugs as documentation**: The missing rate limiter is a teaching moment. Tests prevent silent deployment.
5. **Production is different**: Local testing doesn't simulate bots, DDoS, or security scans.
