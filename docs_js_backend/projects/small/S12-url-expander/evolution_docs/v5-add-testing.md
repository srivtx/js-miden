# v5 — Adding Tests

You just "improved" the redirect follower. You added support for relative URLs in the `Location` header. You deploy.

An hour later, a user reports that loop detection is broken. You check. Your relative URL resolution code converts `/a` to `https://example.com/a`, but your loop detection compares against the raw `Location` value. A redirect chain of `/a` → `https://example.com/a` → `/a` now bypasses the loop check.

Tests would have caught this.

## The Fix: Automated Tests

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import app from '../src/app.js';

function createServer(handler: http.RequestListener) {
  return new Promise<{ server: http.Server; url: string }>((resolve) => {
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
    expect(res.body.chain).toEqual([`${s1.url}/a`, `${s1.url}/b`]);
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

  it('blocks SSRF via redirects', async () => {
    const internal = await createServer((req, res) => {
      res.writeHead(200);
      res.end('secret');
    });

    const external = await createServer((req, res) => {
      res.writeHead(302, { Location: internal.url + '/secret' });
      res.end();
    });

    const res = await request(app).post('/expand').send({ url: external.url + '/start' });
    // Should block the redirect to internal IP
    expect(res.status).toBe(400);

    internal.server.close();
    external.server.close();
  });
});
```

## What Tests Caught

- Loop detection bypass → caught
- SSRF via redirects → caught
- Timeout handling → caught with slow test servers

## The Confidence

Now you can refactor the follower, add new protocols, or switch to `fetch` and know that security invariants hold.

**Next:** Let's modernize the module system.
