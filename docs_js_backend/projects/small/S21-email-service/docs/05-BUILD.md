# 05-BUILD.md

## Prerequisites

- Node.js 20+
- npm or pnpm

## Step-by-Step Build

### Step 1: Clone and Install
```bash
cd S21-email-service
npm install
```

### Step 2: Understand the Project Structure
```
S21-email-service/
├── src/
│   ├── index.ts      # Express server setup
│   ├── routes.ts     # HTTP endpoints
│   ├── service.ts    # Business logic (BUGS HERE)
│   └── types.ts      # TypeScript interfaces
├── tests/
│   └── app.test.ts   # Failing tests prove bugs
├── docs/
│   └── (this documentation)
├── package.json
└── tsconfig.json
```

### Step 3: Run the Tests (They Will Fail)
```bash
npm test
```

Expected failures:
- `should return immediately with queued status` — takes 500ms instead of < 50ms
- `should retry bounced emails` — bounced emails never retry

### Step 4: Fix Bug 1 — Make sendEmail Async

Edit `src/service.ts`:
```typescript
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  // ... build email object ...
  
  email.status = 'queued';  // NOT 'sending'
  emailStore.set(email.id, email);
  
  // REMOVE: await mockSmtpSend(email);
  
  return email;  // Returns in < 1ms
}
```

### Step 5: Fix Bug 2 — Add Retry Logic

Edit `src/service.ts` in `processQueue()`:
```typescript
export async function processQueue(): Promise<void> {
  const queued = Array.from(emailStore.values()).filter(e => e.status === 'queued');
  
  for (const email of queued) {
    email.status = 'sending';
    const result = await mockSmtpSend(email);
    
    if (result.success) {
      email.status = 'sent';
      email.sentAt = new Date();
    } else {
      email.attempts++;
      if (email.attempts < 3) {
        email.status = 'queued';  // Retry later
      } else {
        email.status = 'bounced';
      }
    }
  }
}
```

### Step 6: Run Tests Again
```bash
npm test
```

All tests should now pass.

### Step 7: Run the Server
```bash
npm run dev
```

Test with curl:
```bash
# Send a welcome email
curl -X POST http://localhost:3000/emails/send \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","templateId":"welcome","variables":{"name":"Alice"}}'

# Check queue status
curl http://localhost:3000/emails/queue

# Process queue manually
curl -X POST http://localhost:3000/emails/process-queue

# Check specific email status
curl http://localhost:3000/emails/status/<id>
```

### Step 8: Production Upgrade Path

1. Replace in-memory `emailStore` with Redis
2. Replace manual `processQueue` with BullMQ worker
3. Replace `mockSmtpSend` with Nodemailer + real SMTP provider
4. Add idempotency key deduplication
5. Add webhook endpoint for provider bounce/complaint events
