import { createHash } from 'crypto';
import type { Transaction } from '../types.js';

export function signTransaction(tx: Omit<Transaction, 'id' | 'hash' | 'signature' | 'status' | 'createdAt'>, privateKey: string): string {
  const payload = `${tx.from}${tx.to}${tx.value}${tx.nonce}${tx.gasPrice}${tx.gasLimit}${tx.data}`;
  // Mock signature
  return createHash('sha256').update(payload + privateKey).digest('hex');
}

export function verifyTransaction(tx: Transaction): boolean {
  // Mock verification
  return tx.signature.length === 64;
}
