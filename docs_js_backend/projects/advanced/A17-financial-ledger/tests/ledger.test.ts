import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Ledger Integrity', () => {
  it('should verify ledger integrity', async () => {
    const res = await request(app)
      .get('/api/journal/verify')
      .set('x-api-key', 'ledger-secret-key');

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('should maintain audit chain', async () => {
    const asset = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '7000', name: 'Audit Asset', type: 'asset', currency: 'USD' });

    const equity = await request(app)
      .post('/api/accounts')
      .set('x-api-key', 'ledger-secret-key')
      .send({ code: '8000', name: 'Audit Equity', type: 'equity', currency: 'USD' });

    const tx = await request(app)
      .post('/api/transactions')
      .set('x-api-key', 'ledger-secret-key')
      .send({
        reference: 'TX-AUDIT',
        description: 'Audit test',
        date: new Date().toISOString(),
        currency: 'USD',
        entries: [
          { accountId: asset.body.id, debit: 200, credit: 0 },
          { accountId: equity.body.id, debit: 0, credit: 200 },
        ],
      });

    await request(app)
      .post(`/api/transactions/${tx.body.id}/post`)
      .set('x-api-key', 'ledger-secret-key');

    const auditRes = await request(app)
      .get('/api/journal/audit')
      .set('x-api-key', 'ledger-secret-key');

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.length).toBeGreaterThan(0);

    const verifyRes = await request(app)
      .get('/api/journal/audit/verify')
      .set('x-api-key', 'ledger-secret-key');

    expect(verifyRes.body.valid).toBe(true);
  });
});
