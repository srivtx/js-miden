# S02 Contact Form — Key Concepts

## 1. Rate Limiting Algorithms

### Fixed Window Counter (used here)
- Divide time into discrete windows (e.g., 1 hour).
- Increment a counter per IP per window.
- **Pros**: Simple, low Redis overhead.
- **Cons**: Allows burst at window boundary ("thundering herd" at :59 and :00).

### Sliding Window Log
- Store every request timestamp in a sorted set.
- On each request, drop timestamps outside the window, then count.
- **Pros**: Perfect accuracy, no boundary bursts.
- **Cons**: O(log n) memory and CPU per request; Redis storage grows with traffic.

### Sliding Window Counter (hybrid)
- Combine current window count + weighted previous window count.
- Estimates without storing every request.
- **Pros**: Near-perfect accuracy, constant memory.
- **Cons**: Slightly more complex; approximation can under-count by up to 2× in worst case.

### Token Bucket
- Each IP has a bucket with `max` tokens refilled at steady rate.
- **Pros**: Bursts allowed up to bucket size, then smooths to average rate.
- **Cons**: Harder to share state across multiple server instances without Redis Lua scripting.

**Why we chose fixed window**: It is the simplest to implement correctly and sufficient for a low-traffic contact form. For a high-traffic public API, sliding window or token bucket is preferred.

## 2. Honeypot Fields

A honeypot is a hidden form field that humans do not see but bots fill in.

```html
<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
```

If `website` is non-empty, we silently return `200 OK` without processing.

**Why it works**: Bots parse HTML and fill every field. Humans using standard browsers never interact with it.

**Limitations**:
- Screen-reader users may land on the field; use `aria-hidden="true"`.
- Sophisticated bots that execute CSS may skip it.
- It is not a substitute for rate limiting.

## 3. Bot Protection Layers

| Layer | Catches | Cost |
|-------|---------|------|
| Honeypot | Dumb bots | Zero UX friction |
| Rate limiting | Scripts, brute force | Zero UX friction |
| CAPTCHA/reCAPTCHA | Advanced bots | High UX friction |
| WAF (Cloudflare/AWS) | Distributed attacks | Infrastructure cost |

Defense in depth means combining layers. A honeypot alone stops ~70% of naive spam; rate limiting stops burst abuse; CAPTCHA is the last resort.

## 4. Email Validation

`validator.isEmail()` checks RFC-compliant syntax. It does **not** verify:
- Whether the domain has an MX record.
- Whether the mailbox exists.

For stronger validation, add:
1. **DNS/MX check**: `dns.resolveMx(domain)` — proves the domain accepts mail.
2. **SMTP handshake**: Connect to MX and verify RCPT TO — risky, slow, and often blocked.
3. **Disposable domain list**: Reject `mailinator.com`, `guerrillamail.com`, etc.

**Normalization**: `validator.normalizeEmail()` lowercases the local part for Gmail (removes dots and plus aliases). Always normalize before deduplication or rate-limit keys.

## 5. GDPR Considerations

This project stores **no persistent data**.

| GDPR Principle | Implementation |
|----------------|----------------|
| Lawfulness | Consent via form submission |
| Purpose limitation | Only for replying to the message |
| Data minimization | Name, email, message only |
| Storage limitation | Console logs (ephemeral; must rotate) |
| Integrity | Sanitized to prevent log injection |

**Why no DB?** Eliminates breach surface. If you must store submissions, encrypt at rest, set a retention policy (e.g., 90 days), and provide a deletion endpoint.

## 6. Fail-Open vs Fail-Closed

The rate limiter `catch` block calls `next()` when Redis is down.

- **Fail-open**: Request proceeds. Service stays available but unprotected.
- **Fail-closed**: Request is rejected with 503. Safer but creates outage.

For a contact form, fail-open is usually correct because availability matters more than temporary protection loss. For authentication endpoints, fail-closed is mandatory.
