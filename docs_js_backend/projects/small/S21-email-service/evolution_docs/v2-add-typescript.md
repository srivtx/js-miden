# S21 Email Service — v2 Add TypeScript

## The Bug: Types Catch Email Bugs

You add template support:

```js
function applyTemplate(template, variables) {
  let subject = template.subject;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return { subject, body: template.body };
}
```

**The bug:** `template` might be `undefined` if the template ID doesn't exist. `template.subject` throws `TypeError`. Another bug:
```js
const email = {
  id: generateId(),
  to: req.to,
  from: req.from,
  status: 'quued', // Bug: typo in status
};
```

Without types, `'quued'` is just a string. Your queue processor skips it because it expects `'queued'`.

## The Fix: Add TypeScript

```ts
// types.ts
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface QueuedEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  status: 'queued' | 'sending' | 'sent' | 'bounced' | 'opened';
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
}

export interface SendEmailRequest {
  to: string;
  from: string;
  subject: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
}
```

```ts
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

**What TS catches:**
- `template: undefined` → compile error if not guarded
- `status: 'quued'` → compile error: not assignable to union type
- Missing `attempts` field → compile error

## The Pain That Remains

TypeScript knows `status` is `'queued' | 'sending' | 'sent' | 'bounced' | 'opened'`, but it doesn't enforce that `attempts < 3` before marking as `bounced`. It doesn't know that `to` must be a valid email format. We need runtime validation.

## What v3 Fixes

Validation. Ensure every email request is sane before it enters the queue.
