# S02 Contact Form — Security

## Intentional Bug: Rate Limiter Not Applied

**Location**: `src/routes/contact.ts`, line 9

```ts
router.post('/contact', validateContact, (req: Request, res: Response) => {
```

The `rateLimiter` middleware is imported but never added to the route chain.

### Real-World Consequence
An attacker can POST to `/contact` as fast as their network allows. With a simple `curl` loop:

```bash
while true; do curl -X POST http://localhost:3000/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"x","email":"a@b.com","message":"spam"}'; done
```

This produces:
- **Log flooding**: Ephemeral logs still consume disk I/O and blur legitimate submissions.
- **Resource exhaustion**: Each request triggers validation and console I/O; at 10,000 req/s the event loop saturates.
- **Downstream email provider blacklisting**: If this were wired to SendGrid/SES, the provider would suspend the account for spam.

### Fix
```ts
router.post('/contact', rateLimiter, validateContact, (req, res) => {
```

## Threat Model

| Threat | Mitigation | Status |
|--------|------------|--------|
| SQL Injection | No database used | N/A |
| XSS in logs | `validator.escape()` on name/message | ✅ |
| Email header injection | `validator.isEmail()` + normalization | ✅ |
| Bot spam | Honeypot field | ✅ |
| Rate abuse | Redis rate limiter | ❌ NOT APPLIED |
| DoS (large payload) | Express default body limit (~100KB) | ⚠️ Consider lowering |
| Log injection | Newlines escaped by `validator.escape` | ✅ |

## GDPR & Privacy Risks

| Risk | Current State | Recommendation |
|------|---------------|----------------|
| PII in logs | Console only, ephemeral | Add log rotation (e.g., `pino` with daily files + 7-day retention) |
| Data retention | None defined | Document retention policy |
| Right to erasure | Not applicable (no storage) | If you add a DB, build a deletion endpoint |
| Data breach | Minimal (no DB) | Add TLS in transit |

## Input Sanitization Deep Dive

`validator.escape()` replaces:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#x27;`

This prevents log injection attacks where a message like:
```
Hello\n[ERROR] SYSTEM COMPROMISED
```
would create fake log lines. However, escape is **not sufficient** if logs are rendered in HTML dashboards — use CSP headers and context-aware encoding there.

## Rate Limiter Fail-Open Risk

If Redis is down, the rate limiter allows all requests. In a DDoS scenario:
1. Attacker detects 429 responses.
2. Attacker targets Redis with network saturation.
3. Redis becomes unreachable.
4. Application opens the floodgates.

**Mitigation**: Monitor Redis health. If unavailable for >30 seconds, switch to in-memory rate limiting as a fallback, or return 503 with a static HTML error page.

## Honeypot Evasion

Advanced bots using headless Chrome (Puppeteer/Playwright) execute CSS and will skip `display:none` fields. Countermeasures:
1. Position field off-screen (`position:absolute; left:-9999px`) instead of `display:none`.
2. Add a short JavaScript timer that disables the form submit if the honeypot is filled within <100ms (too fast for a human).
3. Track mouse movement / focus events client-side.
