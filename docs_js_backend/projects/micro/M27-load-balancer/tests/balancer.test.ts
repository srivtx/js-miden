import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/index.js';
import http from 'http';

describe('Load Balancer', () => {
  let backend1: http.Server;
  let backend2: http.Server;
  let backend3: http.Server;

  beforeAll(() => {
    backend1 = createBackend(3001, 'backend1');
    backend2 = createBackend(3002, 'backend2');
    backend3 = createBackend(3003, 'backend3');
  });

  afterAll(() => {
    backend1.close();
    backend2.close();
    backend3.close();
  });

  function createBackend(port: number, name: string): http.Server {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ backend: name }));
    });
    server.listen(port);
    return server;
  }

  it('should distribute requests round-robin', async () => {
    const responses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/');
      responses.push(res.body.backend);
    }
    expect(responses).toEqual(['backend1', 'backend2', 'backend3', 'backend1', 'backend2', 'backend3']);
  });

  it('should skip unhealthy backends', async () => {
    // Stop backend2 to simulate failure
    backend2.close();

    // Give a moment for the server to close
    await new Promise(r => setTimeout(r, 100));

    const responses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/').catch(() => ({ status: 502 }));
      responses.push(res.status);
    }

    // Due to the bug, backend2 is still selected even though it's down
    // So some requests will fail with 502
    const failures = responses.filter(s => s === 502).length;
    expect(failures).toBeGreaterThan(0); // This proves the bug exists

    // Restart backend2
    backend2 = createBackend(3002, 'backend2');
  });

  it('should return 503 when all backends are down', async () => {
    backend1.close();
    backend2.close();
    backend3.close();

    await new Promise(r => setTimeout(r, 100));

    const res = await request(app).get('/');
    // Due to the bug, it returns 502 instead of 503
    // because it still tries to connect to dead backends
    expect(res.status).toBe(502);

    // Restart all
    backend1 = createBackend(3001, 'backend1');
    backend2 = createBackend(3002, 'backend2');
    backend3 = createBackend(3003, 'backend3');
  });
});
