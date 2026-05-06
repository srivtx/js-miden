import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M17 CSV Parser API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /upload-csv parses simple CSV', async () => {
    const csv = 'name,email\nAlice,alice@example.com\nBob,bob@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name,email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowCount).toBe(2);
    expect(res.body.data[0].name).toBe('Alice');
  });

  it('rejects missing required headers', async () => {
    const csv = 'name,email\nAlice,alice@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name,missing' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required header');
  });

  it('strips BOM from UTF-8 CSV', async () => {
    const csv = '\uFEFFname,email\nAlice,alice@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name' });

    expect(res.status).toBe(200);
    expect(res.body.headers[0]).toBe('name');
  });

  it('sanitizes formula injection cells', async () => {
    const csv = 'name,formula\nAlice,=cmd|(\' /C calc\')!A0';
    const res = await request(app).post('/upload-csv').send({ csv });

    expect(res.status).toBe(200);
    expect(res.body.data[0].formula).toBe("'=cmd|(' /C calc')!A0");
  });

  it('enforces maxRows limit', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => `name${i}`).join('\n');
    const csv = `name\n${rows}`;
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, maxRows: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Row count exceeds maximum');
  });

  it('rejects empty CSV', async () => {
    const res = await request(app).post('/upload-csv').send({ csv: '' });
    expect(res.status).toBe(400);
  });
});
