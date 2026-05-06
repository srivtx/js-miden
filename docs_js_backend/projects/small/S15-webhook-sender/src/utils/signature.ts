import crypto from 'crypto';

export function generateSignature(payload: object, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

export function verifySignature(payload: object, secret: string, signature: string): boolean {
  const expected = generateSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
