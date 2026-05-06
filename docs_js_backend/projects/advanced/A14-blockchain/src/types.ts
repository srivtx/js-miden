export interface Wallet {
  id: string;
  userId: string;
  address: string;
  balance: string;
  nonce: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  nonce: number;
  gasPrice: string;
  gasLimit: string;
  data: string;
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  createdAt: Date;
}

export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactions: string[];
  miner: string;
}

export interface SmartContract {
  id: string;
  address: string;
  abi: string;
  bytecode: string;
  deployedAt: Date;
}
