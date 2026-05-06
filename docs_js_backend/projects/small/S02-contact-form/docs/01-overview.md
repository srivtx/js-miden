# S02 Contact Form — Overview

## Project Goal
Build a production-ready contact form endpoint that accepts submissions from a public website, validates input, protects against abuse, and respects user privacy under GDPR.

## Architecture
```
Client → Express /contact POST
         ├── validateContact (middleware)
         │   ├── field validation
         │   ├── email normalization
         │   └── honeypot bot detection
         ├── rateLimiter (middleware) ← INTENTIONALLY NOT APPLIED (BUG)
         └── contact handler (logs to stdout, no persistence)
```

## Tech Stack
- **Runtime**: Node.js + Express + TypeScript
- **Validation**: `validator` library
- **Rate Limiting**: Redis (ioredis) with fixed-window counter
- **Privacy**: No database; ephemeral console logs only

## What This Project Demonstrates
1. Multi-layer bot protection (validation + honeypot + rate limiting)
2. Input sanitization before logging
3. Privacy-by-design (no persistent storage of PII)
4. Graceful degradation when Redis is unavailable (fail-open)

## Quick Start
```bash
npm install
# Start Redis locally, then:
npm run dev
```

## File Map
| File | Responsibility |
|------|----------------|
| `src/routes/contact.ts` | Route handler, logs submission |
| `src/middleware/validator.ts` | Field validation, honeypot, sanitization |
| `src/middleware/rateLimiter.ts` | Redis-based fixed-window rate limiter |
| `src/config.ts` | Environment & rate limit constants |
| `tests/contact.test.ts` | Integration tests |

## Production Checklist
- [ ] Apply rate limiter to route (see `05-security.md`)
- [ ] Replace console logging with structured logger (Pino/Winston)
- [ ] Rotate logs so PII does not accumulate
- [ ] Add TLS termination and HSTS headers
- [ ] Consider adding a CAPTCHA for high-risk traffic
