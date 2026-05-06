import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getTransactions } from '../src/db.js';

function makeToken(userId: string) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret');
}

describe('A14 Blockchain Backend', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('BUG: Nonce reuse', () => {
    it('should not reuse nonce for concurrent transactions', async () => {
      const user = 'user-1';

      // Create wallet
      const walletRes = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${makeToken(user)}`);
      const wallet = walletRes.body;

      // Send two transactions concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${makeToken(user)}`)
          .send({
            from: wallet.address,
            to: '0xrecipient1',
            value: '100',
            gasPrice: '1',
            gasLimit: '21000',
            privateKey: 'pk1',
          }),
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${makeToken(user)}`)
          .send({
            from: wallet.address,
            to: '0xrecipient2',
            value: '200',
            gasPrice: '1',
            gasLimit: '21000',
            privateKey: 'pk1',
          }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const txs = Array.from(getTransactions().values()).filter(t => t.from === wallet.address);
      const nonces = txs.map(t => t.nonce);

      // BUG: Both transactions may have nonce 0 due to race condition
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(nonces.length);
    });
  });

  describe('BUG: No confirmation waiting', () => {
    it('should return only after transaction is confirmed', async () => {
      const user = 'user-1';
      const walletRes = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${makeToken(user)}`);
      const wallet = walletRes.body;

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken(user)}`)
        .send({
          from: wallet.address,
          to: '0xrecipient',
          value: '100',
          gasPrice: '1',
          gasLimit: '21000',
          privateKey: 'pk1',
        });

      // BUG: Returns 200 with success: true even though tx is still pending
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.status).toBe('confirmed');
    });
  });

  describe('Features', () => {
    it('should create a wallet', async () => {
      const res = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${makeToken('user1')}`);
      expect(res.status).toBe(201);
      expect(res.body.address).toBeDefined();
      expect(res.body.nonce).toBe(0);
    });

    it('should create a transaction', async () => {
      const user = 'user1';
      const walletRes = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${makeToken(user)}`);
      const wallet = walletRes.body;

      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${makeToken(user)}`)
        .send({
          from: wallet.address,
          to: '0xrecipient',
          value: '100',
          gasPrice: '1',
          gasLimit: '21000',
          privateKey: 'pk1',
        });

      expect(res.status).toBe(200);
      expect(res.body.transaction.hash).toBeDefined();
    });

    it('should retrieve a block', async () => {
      const res = await request(app).get('/api/blocks/latest');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should deploy a contract', async () => {
      const res = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${makeToken('user1')}`)
        .send({
          address: '0xcontract',
          abi: '[]',
          bytecode: '0x',
        });
      expect(res.status).toBe(201);
    });
  });
});
