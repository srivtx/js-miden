import { getWalletByAddress, updateWallet } from '../db.js';

// BUG: Nonce reuse under concurrent requests.
// getNonce reads the current nonce, returns it, and then incrementNonce
// updates it. Between read and write, another request can read the same nonce,
// causing both transactions to use the same nonce. This enables replay attacks.

export async function getNonce(address: string): Promise<number> {
  const wallet = getWalletByAddress(address);
  if (!wallet) throw new Error('Wallet not found');
  // Simulate async DB read to allow interleaving
  await new Promise(r => setTimeout(r, 5));
  return wallet.nonce;
}

export async function incrementNonce(address: string): Promise<void> {
  const wallet = getWalletByAddress(address);
  if (!wallet) throw new Error('Wallet not found');
  // Simulate async DB write to allow interleaving
  await new Promise(r => setTimeout(r, 5));
  wallet.nonce += 1;
  updateWallet(wallet);
}
