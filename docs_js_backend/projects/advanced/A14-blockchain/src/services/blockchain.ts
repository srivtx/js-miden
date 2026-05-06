import type { Transaction, Block } from '../types.js';
import { createTransaction, getTransactionByHash, createBlock } from '../db.js';

// Mock blockchain interaction

export async function broadcastTransaction(tx: Transaction): Promise<void> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 10));
  createTransaction(tx);
}

export async function waitForConfirmation(hash: string, timeoutMs = 5000): Promise<Transaction | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tx = getTransactionByHash(hash);
    if (tx && tx.status === 'confirmed') {
      return tx;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

export async function mineBlock(transactions: string[]): Promise<Block> {
  const blockNumber = Date.now();
  const block: Block = {
    number: blockNumber,
    hash: '0x' + Math.random().toString(16).slice(2),
    parentHash: '0x' + Math.random().toString(16).slice(2),
    timestamp: new Date(),
    transactions,
    miner: '0xminer',
  };
  createBlock(block);
  return block;
}
