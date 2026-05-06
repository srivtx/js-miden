import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M18 Timezone API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /time/:timezone returns time for valid zone', async () => {
    const res = await request(app).get('/time/Asia/Tokyo');
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Tokyo');
    expect(res.body.currentTime).toContain('+09:00');
    expect(typeof res.body.isDST).toBe('boolean');
  });

  it('GET /time/:timezone rejects invalid zone', async () => {
    const res = await request(app).get('/time/Invalid/Zone');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid timezone');
  });

  it('GET /convert converts time between zones', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'America/New_York', time: '2024-06-15T14:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.from).toBe('UTC');
    expect(res.body.to).toBe('America/New_York');
    expect(res.body.convertedTime).toContain('-04:00');
  });

  it('GET /convert rejects missing parameters', async () => {
    const res = await request(app).get('/convert').query({ from: 'UTC' });
    expect(res.status).toBe(400);
  });

  it('GET /convert rejects invalid time format', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'Asia/Tokyo', time: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});
