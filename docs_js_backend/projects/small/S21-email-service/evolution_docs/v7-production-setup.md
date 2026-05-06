# S21 Email Service — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S21-email-service/
├── src/
│   ├── index.ts            # Express app
│   ├── routes.ts           # HTTP endpoints
│   ├── service.ts          # Email queue + sending logic
│   └── types.ts            # TypeScript interfaces
├── tests/
│   └── app.test.ts         # Node.js test runner + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Queue-Based Sending**

```ts
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    from: req.from,
    subject: req.subject,
    body: req.body,
    templateId: req.templateId,
    variables: req.variables,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };

  emailStore.set(email.id, email);
  return email;
}
```

The HTTP response returns immediately with `status: 'queued'`. A background worker processes the queue asynchronously.

**2. Template System**

```ts
const templates: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome, {{name}}!',
    body: 'Hi {{name}}, welcome to our platform.',
  },
  {
    id: 'reset',
    name: 'Password Reset',
    subject: 'Reset your password',
    body: 'Click here to reset: {{link}}',
  },
];

function applyTemplate(template: EmailTemplate, variables: Record<string, string>) {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return { subject, body };
}
```

Templates are defined once and reused. Marketing can update copy without code changes.

**3. Retry Logic**

```ts
export async function processQueue(): Promise<void> {
  const queued = Array.from(emailStore.values()).filter(e => e.status === 'queued');
  for (const email of queued) {
    email.status = 'sending';
    email.attempts++;
    const result = await mockSmtpSend(email);

    if (result.success) {
      email.status = 'sent';
      email.sentAt = new Date();
    } else {
      if (email.attempts < 3) {
        email.status = 'queued'; // Retry later
      } else {
        email.status = 'bounced'; // Permanently failed
      }
    }
  }
}
```

Bounced emails are retried up to 3 times before being marked as permanently failed.

**4. Delivery Tracking**

```ts
export async function getEmailStatus(id: string): Promise<QueuedEmail | undefined> {
  return emailStore.get(id);
}
```

Every email has a unique ID. You can query its status at any time.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two bugs:

**Bug 1: No Queue — Sends Synchronously**
```ts
// BUG: Sends synchronously instead of queuing.
// This blocks the HTTP response for 500ms+ per email.
email.status = 'sending';
const result = await mockSmtpSend(email);
```

`sendEmail` blocks for 500ms instead of returning immediately.

**Bug 2: No Retry — Bounce = Permanently Failed**
```ts
// BUG: Bounce = permanently failed, never retried.
email.status = 'bounced';
```

Bounced emails are never retried. They should be requeued for up to 3 attempts.

**Why are these here?** To demonstrate that an email service without tests is worse than no email service. The tests in `app.test.ts` verify:
- Response must return in < 50ms with `queued` status
- Bounced emails must be retried, not permanently failed

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Synchronous SMTP, no retry, no tracking | Wrote naive JS |
| v2 | Type errors in email handling | Added TypeScript |
| v3 | Invalid emails entering queue | Added runtime validation |
| v4 | Silent delivery failures | Added structured logging |
| v5 | Queue bypassed, retries removed | Added comprehensive email tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
