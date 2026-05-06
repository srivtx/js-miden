/**
 * BUGGY WEBHOOK RECEIVER - DO NOT USE IN PRODUCTION
 *
 * Bugs:
 * 1. No signature verification (accepts any POST request).
 * 2. No timestamp / replay check.
 * 3. Processes synchronously before responding (slow processing causes timeouts / retries).
 */

import { IncomingHttpHeaders } from 'http';
import crypto from 'crypto';

const eventLogBuggy: Array<{
  provider: string;
  eventId: string;
  receivedAt: string;
  status: string;
}> = [];

export function verifyWebhookBuggy(
  _provider: string,
  _payload: Buffer,
  _headers: IncomingHttpHeaders
): {
  valid: boolean;
  eventId?: string;
  tooOld?: boolean;
  duplicate?: boolean;
} {
  // Bug 1: Always returns valid, never checks HMAC
  return { valid: true, eventId: 'buggy-event-id' };
}

export function processEventBuggy(
  provider: string,
  eventId: string,
  _payload: Buffer,
  _headers: IncomingHttpHeaders
) {
  // Bug 3: Synchronous blocking processing before returning 200
  // Simulated by a busy-wait loop or heavy work
  const start = Date.now();
  while (Date.now() - start < 500) {
    // Simulate slow work inline
  }

  eventLogBuggy.push({
    provider,
    eventId,
    receivedAt: new Date().toISOString(),
    status: 'processed',
  });
}

export function getEventsBuggy() {
  return eventLogBuggy;
}
