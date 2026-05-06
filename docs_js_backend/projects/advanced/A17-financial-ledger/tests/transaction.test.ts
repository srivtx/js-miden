import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Transaction API', () => {
  it('should create a transaction', async () => {
    const asset = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '2000', name: 'Inventory', type: 'asset', currency: 'USD' });

    const liability = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '3000', name: 'Payables', type: 'liability', currency: 'USD' });

    const tx = await request(app)
      .post('/api/transactions')
      .set('x-api-key', 'ledger-secret-key')
      .send({
        reference: 'TX-003',
        description: 'Purchase on credit',
        date: new Date().toISOString(),
        currency: 'USD',
        entries: [
          { accountId: asset.body.id, debit: 500, credit: 0 },
          { accountId: liability.body.id, debit: 0, credit: 500 },
        ],
      });

    expect(tx.status).toBe(201);
    expect(tx.body.entries).toHaveLength(2);
  });

  it('should post a transaction and update balances', async () => {
    const asset = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '2001', name: 'Cash', type: 'asset', currency: 'USD' });

    const equity = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '6000', name: 'Equity', type: 'equity', currency: 'USD' });

    const tx = await request(app)
      .post('/api/transactions')
      .set('x-api-key', 'ledger-secret-key')
      .send({
        reference: 'TX-004',
        description: 'Owner investment',
        date: new Date().toISOString(),
        currency: 'USD',
        entries: [
          { accountId: asset.body.id, debit: 1000, credit: 0 },
          { accountId: equity.body.id, debit: 0, credit: 1000 },
        ],
      });

    const posted = await request(app)
      .post(`/api/transactions/${tx.body.id}/post`)
      .set('x-api-key', 'ledger-secret-key');

    expect(posted.status).toBe(200);
    expect(posted.body.status).toBe('posted');

    const balance = await request(app)
      .get(`/api/accounts/${asset.body.id}/balance`)
      .set('x-api-key', 'ledger-secret-key');

    expect(balance.body.netBalance).toBe(1000);
  });
});
