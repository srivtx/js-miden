import { config } from '../config.js';

// Simple field-level encryption for sensitive data
// In production, use AWS KMS, HashiCorp Vault, or similar

export function encrypt(text: string): string {
  // Mock encryption - XOR with key for demonstration
  const key = config.encryptionKey;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

export function decrypt(cipher: string): string {
  const key = config.encryptionKey;
  const text = Buffer.from(cipher, 'base64').toString('ascii');
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}
