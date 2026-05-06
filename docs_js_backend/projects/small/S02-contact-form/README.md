# S02: Contact Form Backend

## Phase 1: Requirements
- **POST /contact** accepts `name`, `email`, `message`
- Validates all fields (email format, name length, message not empty)
- Rate limits: 3 submissions per hour per IP
- Sends confirmation response
- "Emails" are logged to console (no actual email service)

## Phase 2-3: Thinking Framework

### What validations?
| Field | Rule |
|-------|------|
| name  | 2–100 chars, trimmed |
| email | Valid format via `validator.isEmail` |
| message | 1–5000 chars, not empty |
| website | Honeypot — if filled, silently reject |

### Rate Limiting Strategy
- **Fixed window** in Redis
- Key: `rate_limit:contact:${ip}`
- Window: 1 hour (`60 * 60 * 1000` ms)
- Max: 3 requests per window
- Implementation: `INCR` then `PEXPIRE` on first request
- **Fail open**: if Redis is unavailable, allow the request (availability > strictness)

### Bot Protection
- **Honeypot field**: Hidden `website` input on the frontend
- Bots tend to fill all visible/hidden fields; humans won't see it
- Returns HTTP 200 to avoid tipping off bots that they were detected

### Data Retention (GDPR)
- **No database storage** — submissions are only logged to stdout
- Logs should be ephemeral and rotated (e.g., `logrotate`) to avoid retaining PII indefinitely
- If persistence is ever added, implement TTL-based auto-deletion (e.g., 30 days)

## Bug
**No rate limiting is applied.** The `rateLimiter` middleware is imported in `src/routes/contact.ts` but is **not passed to the route handler**. This means an attacker can submit the form unlimited times, creating a spam vulnerability.

### Fix
```ts
router.post('/contact', rateLimiter, validateContact, handler);
```

## Running
Requires Redis running locally (default port 6379).

```bash
npm install
npm run dev
```

## Testing
```bash
npm test
```
