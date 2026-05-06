# 06-BUGS.md

## Bug 1: No Queue — Sends Synchronously

**Location:** `src/service.ts`, `sendEmail()` function, lines 74-75

**Current Code:**
```typescript
email.status = 'sending';
const result = await mockSmtpSend(email);  // BLOCKS for 500ms
```

**Real-World Impact:**

### Scenario: Black Friday Sale
Your e-commerce platform sends 10,000 order confirmation emails in 1 hour.

- **Naive approach**: Each email blocks for 500ms = 83 minutes of blocked event loop
- **With 100 concurrent users**: Event loop saturated, API becomes unresponsive
- **Result**: Checkout page hangs, customers abandon carts, revenue drops 20-40%

### Scenario: Password Reset During Outage
User requests password reset. SMTP server is temporarily slow (2s timeout).

- **Naive approach**: HTTP request hangs for 2 seconds
- **User perception**: "This app is broken"
- **Business impact**: Support tickets spike, churn increases

### Scenario: Server Crash Mid-Send
Email is 90% sent when the server pod is terminated during a deployment.

- **Naive approach**: Email lost. No record it was ever attempted.
- **User impact**: No password reset email. User cannot log in.
- **Compliance impact**: Cannot prove delivery attempt for audit.

**Severity:** HIGH — Directly impacts user experience and revenue

**Fix:** Queue the email, return 202, process in background worker.

---

## Bug 2: No Retry — Bounce = Permanently Failed

**Location:** `src/service.ts`, `sendEmail()` function, lines 81-83

**Current Code:**
```typescript
if (!result.success) {
  email.status = 'bounced';  // NEVER RETRIED
}
```

**Real-World Impact:**

### Scenario: Greylisting
Many enterprise mail servers (Microsoft 365, corporate Exchange) use greylisting: they reject the first delivery attempt with a 4xx code to deter spammers, expecting legitimate senders to retry.

- **Current behavior**: Status = bounced. Email permanently lost.
- **Impact**: 10-30% of B2B emails silently fail.
- **Result**: Sales leads never receive demos. Invoices never reach accounting.

### Scenario: Rate Limiting
AWS SES limits new accounts to 14 emails/second. SendGrid limits to 600/minute for free tiers.

- **Current behavior**: Excess emails bounce permanently.
- **Impact**: Legitimate transactional emails (order confirmations) lost.
- **Result**: Customer calls support: "Where's my confirmation?"

### Scenario: Transient Network Blip
Datacenter has 30-second routing issue.

- **Current behavior**: All emails during that window permanently bounced.
- **Impact**: Hundreds or thousands of lost messages.
- **Result**: Users think your service is unreliable. Trust erodes.

**Severity:** CRITICAL — Causes silent data loss and broken user trust

**Fix:** Increment `attempts`, re-queue if < 3, with exponential backoff.

```typescript
if (!result.success) {
  email.attempts++;
  if (email.attempts < 3) {
    email.status = 'queued';
    scheduleRetry(email.id, Math.pow(2, email.attempts) * 60000);
  } else {
    email.status = 'bounced';
  }
}
```

---

## Additional Bug Surface

### Template Injection Risk
The current `applyTemplate` uses `new RegExp()` without escaping. A variable value containing regex special characters (`$`, `.`, `*`) could corrupt the template or cause a ReDoS.

**Fix:** Escape regex metacharacters or use a proper template engine (Handlebars) that does not use regex replacement.

### No Idempotency
Calling `POST /emails/send` twice with the same data creates two emails. In production, network retries or double-clicks cause duplicate sends.

**Fix:** Accept `Idempotency-Key` header. Store processed keys for 24 hours and return the original response on duplicate.
