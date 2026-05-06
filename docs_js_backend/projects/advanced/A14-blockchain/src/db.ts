import type { Wallet, Transaction, Block, SmartContract } from './types.js';

const wallets = new Map<string, Wallet>();
const transactions = new Map<string, Transaction>();
const blocks = new Map<number, Block>();
const contracts = new Map<string, SmartContract>();

export function resetDb() {
  wallets.clear();
  transactions.clear();
  blocks.clear();
  contracts.clear();
}

export function getWallets() {
  return wallets;
}

export function getTransactions() {
  return transactions;
}

export function getBlocks() {
  return blocks;
}

export function getContracts() {
  return contracts;
}

export function createWallet(wallet: Wallet): Wallet {
  wallets.set(wallet.id, wallet);
  return wallet;
}

export function getWalletByAddress(address: string): Wallet | undefined {
  return Array.from(wallets.values()).find(w => w.address === address);
}

export function getWalletById(id: string): Wallet | undefined {
  return wallets.get(id);
}

export function updateWallet(wallet: Wallet): Wallet {
  wallets.set(wallet.id, wallet);
  return wallet;
}

export function createTransaction(tx: Transaction): Transaction {
  transactions.set(tx.id, tx);
  return tx;
}

export function getTransactionByHash(hash: string): Transaction | undefined {
  return Array.from(transactions.values()).find(t => t.hash === hash);
}

export function createBlock(block: Block): Block {
  blocks.set(block.number, block);
  return block;
}

export function createContract(contract: SmartContract): SmartContract {
  contracts.set(contract.id, contract);
  return contract;
}
