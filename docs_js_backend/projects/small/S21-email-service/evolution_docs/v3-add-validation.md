# S21 Email Service — v3 Add Validation

## The Bug: Validation Catches Email Bugs

Your TypeScript email service accepts any request:

```ts
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    from: req.from,
    subject: req.subject,
    body: req.body,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };
  // ...
}
```

Without validation:
- `to: 'not-an-email'` — TypeScript says it's a `string`, but it's not a valid email
- `from: ''` — empty sender will be rejected by every SMTP server
- `templateId: 'nonexistent'` — the template lookup returns `undefined`, causing a crash
- `variables: undefined` when a template expects `{{name}}` — the raw template is sent to the user

TypeScript ensures the shapes match, but it doesn't validate email formats or template existence at runtime.

## The Fix: Runtime Email Validation

```ts
function validateEmail(email: string): void {
  if (!email || !email.includes('@')) {
    throw new Error(`Invalid email: ${email}`);
  }
}

function validateSendRequest(req: SendEmailRequest): void {
  validateEmail(req.to);
  validateEmail(req.from);
  if (!req.subject && !req.templateId) {
    throw new Error('Either subject or templateId is required');
  }
  if (req.templateId) {
    const template = templates.find(t => t.id === req.templateId);
    if (!template) throw new Error(`Template not found: ${req.templateId}`);
  }
}
```

```ts
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  validateSendRequest(req);
  // ...
}
```

**What validation prevents:**
- Invalid recipient emails are rejected before queuing
- Missing templates are caught with a clear error message
- Empty senders are blocked
- Requests without content are refused

## The Pain That Remains

You validate requests, but you still have no visibility into email delivery. When emails bounce, you don't know why. There's no logging of queue depth, send latency, or bounce reasons.

## What v4 Fixes

Logging. Observe email behavior in production.
