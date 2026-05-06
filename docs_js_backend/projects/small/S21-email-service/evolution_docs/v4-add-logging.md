# S21 Email Service — v4 Add Logging

## The Bug: Production Visibility Crisis

Your email service is supposed to send emails reliably. But in production:
- You don't know how many emails are queued vs sent vs bounced
- You don't know if the queue is backing up
- You can't tell if retries are happening or if bounced emails are permanently lost
- You have no record of delivery latency

```ts
// Without logging — silent sending
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };
  emailStore.set(email.id, email);
  
  email.status = 'sending';
  const result = await mockSmtpSend(email);
  
  if (result.success) {
    email.status = 'sent';
    email.sentAt = new Date();
  } else {
    email.status = 'bounced';
  }
  
  return email;
}
```

An email bounces. You have no log. The user never gets their password reset. They call support. You have no evidence of what happened.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  validateSendRequest(req);
  
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
  logger.info({ emailId: email.id, to: email.to, templateId: email.templateId }, 'Email queued');
  
  return email;
}

export async function processQueue(): Promise<void> {
  const queued = Array.from(emailStore.values()).filter(e => e.status === 'queued');
  logger.info({ count: queued.length }, 'Processing email queue');
  
  for (const email of queued) {
    email.status = 'sending';
    email.attempts++;
    logger.info({ emailId: email.id, attempt: email.attempts }, 'Email sending');
    
    const result = await mockSmtpSend(email);
    
    if (result.success) {
      email.status = 'sent';
      email.sentAt = new Date();
      logger.info({ emailId: email.id, durationMs: Date.now() - email.createdAt.getTime() }, 'Email sent');
    } else {
      logger.warn({ emailId: email.id, error: result.error }, 'Email bounced');
      if (email.attempts < 3) {
        email.status = 'queued';
        logger.info({ emailId: email.id, attempts: email.attempts }, 'Email queued for retry');
      } else {
        email.status = 'bounced';
        logger.error({ emailId: email.id, attempts: email.attempts }, 'Email permanently bounced');
      }
    }
  }
}
```

Now logs tell the story:
```json
{"level":"info","emailId":"abc123","to":"user@example.com","templateId":"welcome","msg":"Email queued"}
{"level":"info","count":5,"msg":"Processing email queue"}
{"level":"info","emailId":"abc123","attempt":1,"msg":"Email sent"}
{"level":"warn","emailId":"def456","error":"Invalid recipient","msg":"Email bounced"}
{"level":"info","emailId":"def456","attempts":1,"msg":"Email queued for retry"}
```

**Ah.** The queue has 5 items. One bounced and will retry. Delivery latency is visible.

## The Pain That Remains

You refactor `processQueue` and accidentally remove the retry limit. Bounced emails retry forever. Your logs show endless retry loops, but you don't have a test that verifies the max retry behavior.

## What v5 Fixes

Testing. Every email state transition needs a test.
