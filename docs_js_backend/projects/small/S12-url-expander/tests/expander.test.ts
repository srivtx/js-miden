import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import app from '../src/app.js';

function createServer(handler: http.RequestListener): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe('URL Expander', () => {
  it('follows redirects and returns chain', async () => {
    const s1 = await createServer((req, res) => {
      if (req.url === '/a') {
        res.writeHead(302, { Location: '/b' });
        res.end();
      } else if (req.url === '/b') {
        res.writeHead(200);
        res.end('ok');
      }
    });

    const res = await request(app).post('/expand').send({ url: `${s1.url}/a` });
    expect(res.status).toBe(200);
    expect(res.body.chain).toEqual([`${s1.url}/a`, `${s1.url}/b`]);
    expect(res.body.final_url).toBe(`${s1.url}/b`);

    s1.server.close();
  });

  it('detects redirect loops', async () => {
    const s1 = await createServer((req, res) => {
      res.writeHead(302, { Location: '/loop' });
      res.end();
    });

    const res = await request(app).post('/expand').send({ url: `${s1.url}/loop` });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('loop');

    s1.server.close();
  });

  it('BUG: SSRF via redirect bypasses initial validation', async () => {
    // Internal server that should never be reached
    const internal = await createServer((req, res) => {
      res.writeHead(200);
      res.end('secret-data');
    });

    // External server that redirects to internal
    const external = await createServer((req, res) => {
      res.writeHead(302, { Location: internal.url + '/secret' });
      res.end();
    });

    // The external URL passes validation
    const res = await request(app).post('/expand').send({ url: external.url + '/start' });
    expect(res.status).toBe(200);
    // BUG: We successfully reached the internal server
    expect(res.body.final_url).toBe(internal.url + '/secret');

    internal.server.close();
    external.server.close();
  });
});
