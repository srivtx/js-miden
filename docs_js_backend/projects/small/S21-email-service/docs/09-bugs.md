# 09-bugs.md

## Bug 1: No Queue — Sends Synchronously

**Location:** `src/service.ts` in `sendEmail()`

**Issue:** `mockSmtpSend` is awaited directly inside the HTTP handler, blocking the response for 500ms per email. Under load this exhausts connections and degrades UX.

**Impact:**
- Slow API responses
- Connection pool exhaustion
- No reliability guarantee if server crashes mid-send

**Fix:**
```typescript
// Return 202 immediately
email.status = 'queued';
return email;

// Process in background worker
async function processQueue() {
  const queued = getQueuedEmails();
  for (const email of queued) {
    email.status = 'sending';
    const result = await mockSmtpSend(email);
    email.status = result.success ? 'sent' : 'bounced';
  }
}
```

## Bug 2: No Retry — Bounce = Permanently Failed

**Location:** `src/service.ts` in `sendEmail()`

**Issue:** Bounced emails get status `bounced` with no retry mechanism. Transient failures (network blips, rate limits) are treated as permanent.

**Impact:**
- Legitimate emails lost
- Poor deliverability metrics
- Users never receive transactional emails

**Fix:**
```typescript
if (!result.success) {
  email.attempts++;
  if (email.attempts < 3) {
    email.status = 'queued';
    // Schedule retry with exponential backoff
  } else {
    email.status = 'bounced';
  }
}
```
