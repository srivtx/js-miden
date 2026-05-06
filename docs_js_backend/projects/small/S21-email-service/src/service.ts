import { QueuedEmail, SendEmailRequest, EmailTemplate } from './types.js';

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

const emailStore: Map<string, QueuedEmail> = new Map();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function applyTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return { subject, body };
}

// BUG: No queue — sends synchronously, blocks response.
// This simulates an SMTP call that takes 500ms and blocks the event loop.
async function mockSmtpSend(email: QueuedEmail): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const bounced = email.to.includes('bounce');
      resolve({ success: !bounced });
    }, 500);
  });
}

export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  let subject = req.subject;
  let body = req.body;

  if (req.templateId) {
    const template = templates.find(t => t.id === req.templateId);
    if (!template) throw new Error('Template not found');
    const applied = applyTemplate(template, req.variables || {});
    subject = applied.subject;
    body = applied.body;
  }

  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    from: req.from,
    subject,
    body,
    templateId: req.templateId,
    variables: req.variables,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };

  emailStore.set(email.id, email);

  // BUG: Sends synchronously instead of queuing.
  // This blocks the HTTP response for 500ms+ per email.
  email.status = 'sending';
  const result = await mockSmtpSend(email);

  if (result.success) {
    email.status = 'sent';
    email.sentAt = new Date();
  } else {
    // BUG: Bounce = permanently failed, never retried.
    email.status = 'bounced';
  }

  return email;
}

export async function getQueueStatus(): Promise<{ queued: number; sending: number; sent: number; bounced: number }> {
  const emails = Array.from(emailStore.values());
  return {
    queued: emails.filter(e => e.status === 'queued').length,
    sending: emails.filter(e => e.status === 'sending').length,
    sent: emails.filter(e => e.status === 'sent').length,
    bounced: emails.filter(e => e.status === 'bounced').length,
  };
}

export async function getEmailStatus(id: string): Promise<QueuedEmail | undefined> {
  return emailStore.get(id);
}

export function getTemplates(): EmailTemplate[] {
  return templates;
}

export async function processQueue(): Promise<void> {
  // This should process queued emails asynchronously.
  // Currently does nothing because sendEmail already sends synchronously.
  const queued = Array.from(emailStore.values()).filter(e => e.status === 'queued');
  for (const email of queued) {
    email.status = 'sending';
    const result = await mockSmtpSend(email);
    email.status = result.success ? 'sent' : 'bounced';
    if (result.success) email.sentAt = new Date();
  }
}
