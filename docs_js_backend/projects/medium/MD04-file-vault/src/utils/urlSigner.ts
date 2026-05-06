import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'default-secret';
const EXPIRATION = parseInt(process.env.SIGNED_URL_EXPIRATION || '3600', 10);

export interface SignedUrlPayload {
  fileId: string;
  expiresAt: number;
}

export function generateSignedUrl(fileId: string): string {
  const expiresAt = Date.now() + EXPIRATION * 1000;
  const payload = `${fileId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const token = Buffer.from(JSON.stringify({ fileId, expiresAt, signature })).toString('base64url');
  return `/api/files/download/${token}`;
}

export function verifySignedUrl(token: string): SignedUrlPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    const { fileId, expiresAt, signature } = decoded;
    const payload = `${fileId}:${expiresAt}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (signature !== expected) return null;
    if (Date.now() > expiresAt) return null;
    return { fileId, expiresAt };
  } catch {
    return null;
  }
}
