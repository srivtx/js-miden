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
