# S02 Contact Form — Production Guide

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | `redis://localhost:6379` | Rate limit store |
| `PORT` | `3000` | HTTP port |
| `RATE_LIMIT_MAX` | `3` | Max submissions per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` (1 hr) | Window size |

## Docker Compose

```yaml
services:
  app:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - RATE_LIMIT_MAX=5
    ports:
      - "3000:3000"
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
volumes:
  redis-data:
```

## TLS & Reverse Proxy

Always run behind Nginx, Caddy, or a cloud load balancer with TLS termination.

```nginx
server {
  listen 443 ssl http2;
  server_name contact.example.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

**Critical**: `req.ip` must be the **client IP**, not the proxy IP. Configure Express:
```ts
app.set('trust proxy', 1); // trust first proxy
```

Without this, rate limiting keys all collapse to `127.0.0.1`, breaking the limiter entirely.

## Log Rotation

If using `pino`:
```bash
node dist/index.js | pino-pretty | rotatelogs -l logs/contact-%Y%m%d.log 86400
```

Set a 7-day retention and archive to S3 Glacier for compliance.

## Alerting

| Metric | Threshold | Action |
|--------|-----------|--------|
| 429 rate > 10% | Warn | Investigate spam wave |
| Redis down | Critical | Fail-open active; investigate |
| 400 rate > 50% | Warn | Bot probing invalid payloads |
| Response time p99 > 100ms | Warn | Add horizontal scaling |

## Scaling Considerations

- **Stateless**: Yes. Any instance can handle any request.
- **Sticky sessions**: Not needed.
- **Horizontal scaling**: Add more app containers; Redis stays shared.

## Incident Response Playbook

**Spam wave detected**
1. Lower `RATE_LIMIT_MAX` to 1 temporarily.
2. Enable reCAPTCHA v3 on the frontend.
3. Review logs for patterns (common IP ranges, email domains).
4. Block IPs at the CDN/WAF level if concentrated.
