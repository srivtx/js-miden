import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';

const SECRETS: Record<string, string> = {
  github: process.env.GITHUB_WEBHOOK_SECRET || 'default-github-secret',
  stripe: process.env.STRIPE_WEBHOOK_SECRET || 'default-stripe-secret',
};

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const processedEvents = new Set<string>();
const eventLog: Array<{
  provider: string;
  eventId: string;
  receivedAt: string;
  status: string;
}> = [];

export function isValidProvider(provider: string): boolean {
  return provider === 'github' || provider === 'stripe';
}

export function verifyWebhook(
  provider: string,
  payload: Buffer,
  headers: IncomingHttpHeaders
): {
  valid: boolean;
  reason?: string;
  eventId?: string;
  tooOld?: boolean;
  duplicate?: boolean;
} {
  const secret = SECRETS[provider];
  if (!secret) {
    return { valid: false, reason: 'No secret configured' };
  }

  if (provider === 'github') {
    const signature = headers['x-hub-signature-256'] as string | undefined;
    if (!signature) {
      return { valid: false, reason: 'Missing signature header' };
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!timingSafeCompare(signature, expected)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    const eventId = (headers['x-github-delivery'] as string) || crypto.randomUUID();

    // GitHub doesn't send a timestamp header; we use delivery time as proxy
    // In real code, you might use the event created_at from payload
    return {
      valid: true,
      eventId,
      tooOld: false,
      duplicate: processedEvents.has(eventId),
    };
  }

  if (provider === 'stripe') {
    const signature = headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return { valid: false, reason: 'Missing signature header' };
    }

    // Parse Stripe-Signature: t=...,v1=...
    const elements = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parseInt(elements['t'] || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > MAX_AGE_MS / 1000) {
      return { valid: true, eventId: elements['t'] || 'unknown', tooOld: true };
    }

    const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    if (!timingSafeCompare(elements['v1'] || '', expected)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    try {
      const parsed = JSON.parse(payload.toString('utf8'));
      const eventId = parsed.id || crypto.randomUUID();
      return {
        valid: true,
        eventId,
        tooOld: false,
        duplicate: processedEvents.has(eventId),
      };
    } catch {
      return { valid: false, reason: 'Invalid JSON payload' };
    }
  }

  return { valid: false, reason: 'Unknown provider' };
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Prevent timing attack on length by still doing a comparison
    crypto.timingSafeEqual(Buffer.from(a.padEnd(b.length, '0')), Buffer.from(b.padEnd(a.length, '0')));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function processEventAsync(
  provider: string,
  eventId: string,
  _payload: Buffer,
  _headers: IncomingHttpHeaders
) {
  processedEvents.add(eventId);
  eventLog.push({
    provider,
    eventId,
    receivedAt: new Date().toISOString(),
    status: 'queued',
  });

  // Simulate async processing (e.g., queue job, background worker)
  setTimeout(() => {
    const entry = eventLog.find((e) => e.eventId === eventId);
    if (entry) entry.status = 'processed';
  }, 100);
}

export function getEvents() {
  return eventLog.slice(-50); // Return last 50 events
}
