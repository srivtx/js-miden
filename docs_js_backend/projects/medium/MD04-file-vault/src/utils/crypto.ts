import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

// BUG 2: Hardcoded encryption key fallback
// If env var is missing, uses predictable key - all files decryptable
export function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }
  // VULNERABILITY: Hardcoded fallback key
  return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
}

export function generateFileKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function encryptFile(data: Buffer, key: Buffer): { encrypted: Buffer; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decryptFile(encrypted: Buffer, key: Buffer, ivHex: string, tagHex: string): Buffer {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function encryptKey(fileKey: Buffer, masterKey: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(fileKey), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptKey(encryptedKey: string, masterKey: Buffer): Buffer {
  const [ivHex, dataHex] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', masterKey, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
