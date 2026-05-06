import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Money Precision', () => {
  it('BUG: should fail on floating-point precision with native numbers', async () => {
    // Create accounts
    const assetRes = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '1000', name: 'Cash', type: 'asset', currency: 'USD' });

    const expenseRes = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '5000', name: 'Supplies', type: 'expense', currency: 'USD' });

    const assetId = assetRes.body.id;
    const expenseId = expenseRes.body.id;

    // Create transaction with 0.1 + 0.2
    const txRes = await request(app)
      .post('/api/transactions')
      .set('x-api-key', 'ledger-secret-key')
      .send({
        reference: 'TX-001',
        description: 'Precision test',
        date: new Date().toISOString(),
        currency: 'USD',
        entries: [
          { accountId: expenseId, debit: 0.1, credit: 0 },
          { accountId: expenseId, debit: 0.2, credit: 0 },
          { accountId: assetId, debit: 0, credit: 0.3 },
        ],
      });

    // BUG: 0.1 + 0.2 !== 0.3 in floating-point, so debits !== credits.
    // The validation may fail or produce incorrect results.
    expect(txRes.status).toBe(500);
    expect(txRes.body.error.message).toContain('Debits');
  });

  it('should succeed when debits exactly equal credits', async () => {
    const assetRes = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '1001', name: 'Bank', type: 'asset', currency: 'USD' });

    const revenueRes = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '4000', name: 'Revenue', type: 'revenue', currency: 'USD' });

    const txRes = await request(app)
      .post('/api/transactions')
      .set('x-api-key', 'ledger-secret-key')
      .send({
        reference: 'TX-002',
        description: 'Exact amount',
        date: new Date().toISOString(),
        currency: 'USD',
        entries: [
          { accountId: assetRes.body.id, debit: 100, credit: 0 },
          { accountId: revenueRes.body.id, debit: 0, credit: 100 },
        ],
      });

    expect(txRes.status).toBe(201);
  });
});
