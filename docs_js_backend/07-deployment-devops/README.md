# Module 07: Deployment & DevOps - From localhost to the Internet

> *"The only difference between a side project and a product is deployment."*

---

## Table of Contents

1. [Why Deployment Feels Scary (And How to Make It Boring)](#1-why-deployment-feels-scary-and-how-to-make-it-boring)
2. [The Pragmatic Shortcut: PaaS for Beginners](#2-the-pragmatic-shortcut-paas-for-beginners)
3. [The 12-Factor App Methodology](#3-the-12-factor-app-methodology)
4. [Environment Management](#4-environment-management)
5. [Docker for Node.js](#5-docker-for-nodejs)
6. [Process Management](#6-process-management)
7. [Reverse Proxy with Nginx/Caddy](#7-reverse-proxy-with-nginxcaddy)
8. [SSL/TLS with Let's Encrypt](#8-ssltls-with-lets-encrypt)
9. [Logging](#9-logging)
10. [Health Checks](#10-health-checks)
11. [CI/CD with GitHub Actions](#11-cicd-with-github-actions)
12. [Serverless Deployment](#12-serverless-deployment)
13. [Monitoring Basics](#13-monitoring-basics)
14. [Mini Project](#14-mini-project-dockerize-the-task-management-api)

---

## 1. Why Deployment Feels Scary (And How to Make It Boring)

### WHAT is deployment anxiety?

Deployment anxiety is the fear that pushing code to production will break everything. It manifests as:
- Deploying only on Tuesdays at 2 PM (because "traffic is low")
- One engineer being the only person allowed to deploy
- Manual checklists of 47 steps, any of which can be skipped by accident

### WHY does it exist?

Because most developers learn to code on `localhost`, where:
- The database is always reachable at `localhost:5432`
- Files are written to `./uploads` and stay there forever
- `console.log` appears in the terminal instantly
- If something breaks, you press `Ctrl+C` and restart

Production is a different planet. The filesystem is ephemeral. The database is on another machine. Logs disappear into a void. Restarting drops active user requests.

### WHAT HAPPENS if you never fix it?

**Knight Capital Group, 2012:** A manual deployment error reused old code on one server. The company lost **$440 million in 45 minutes** and went bankrupt.

**The fix:** Make deployment **boring** — so automated, so tested, so reversible that it feels like `git push`. Boring deployments are safe deployments.

---

## 2. The Pragmatic Shortcut: PaaS for Beginners

> **Sidebar: You Don't Need Docker on Day One**
>
> If you're deploying your first app, you don't need Kubernetes, Terraform, or a custom VPC. You need your app running on the internet with a database attached.

### PaaS: Platform-as-a-Service

PaaS platforms handle servers, databases, and SSL for you. You `git push`, they deploy.

| Platform | Best For | Free Tier | Why Choose It |
|----------|----------|-----------|---------------|
| **Railway** | Full-stack apps, databases | Generous | Best DX, native PostgreSQL/Redis, automatic deploys |
| **Render** | Static sites, APIs, workers | Generous | Simple, great for side projects, free custom domains |
| **Fly.io** | Global edge deployment | Generous | Run apps close to users, excellent for real-time apps |
| **Heroku** | Enterprise, add-ons | Limited | Mature ecosystem, extensive integrations |
| **DigitalOcean App Platform** | VPS users wanting PaaS | Moderate | Predictable pricing, good performance |

### Railway Quick Deploy

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL and Redis
railway add --database postgres
railway add --database redis

# 5. Deploy
railway up
```

### When to Start with PaaS

**Use PaaS when:**
- You're a solo developer or small team
- You don't have DevOps expertise
- You want to validate a product before optimizing infrastructure costs
- You need to ship this week, not next quarter

**Move to VPS/Cloud when:**
- Monthly PaaS costs exceed $200-500 (VPS is cheaper at scale)
- You need specific OS-level configurations
- You have dedicated DevOps resources
- Compliance requires specific infrastructure controls

**The progression:**
```
PaaS (Railway/Render) → VPS (DigitalOcean/Linode) → Cloud (AWS/GCP/Azure)
   Month 1-6              Month 6-18                  Year 2+
```

---

## 3. The 12-Factor App Methodology

### WHAT is it?

The [12-Factor App](https://12factor.net/) is a methodology created by Heroku engineers in 2011. It defines 12 rules for building SaaS applications that are portable, scalable, and suitable for deployment on modern cloud platforms.

### WHY do we need it?

Because without a shared philosophy, every deployment becomes a custom snowflake. One app stores config in JSON files; another in environment variables. One logs to files; another to stdout. These inconsistencies create operational chaos.

### The 12 Factors (Node.js Edition)

| Factor | Rule | Node.js Practice |
|--------|------|------------------|
| **I. Codebase** | One codebase, many deploys | Single Git repo; no code forks per environment |
| **II. Dependencies** | Explicitly declare and isolate | `package.json` + `package-lock.json`; no global installs |
| **III. Config** | Store config in environment | `process.env.DB_PASSWORD`; never hardcode secrets |
| **IV. Backing Services** | Treat as attached resources | `DATABASE_URL` works whether Postgres is local or AWS RDS |
| **V. Build, Release, Run** | Strictly separate stages | Build: `docker build`; Release: `docker run` + env vars; Run: execute |
| **VI. Processes** | Stateless, share-nothing | Sessions in Redis, not `const sessions = {}` |
| **VII. Port Binding** | Export services via ports | `app.listen(3000)` — self-contained, no external web server needed |
| **VIII. Concurrency** | Scale via the process model | Run 8 Node.js processes on an 8-core machine (PM2 cluster) |
| **IX. Disposability** | Fast startup, graceful shutdown | Start in <5s; handle `SIGTERM` to finish active requests |
| **X. Dev/Prod Parity** | Keep environments similar | Docker Compose locally mirrors production containers |
| **XI. Logs** | Treat as event streams | Structured JSON to stdout; let the environment aggregate |
| **XII. Admin Processes** | Run admin tasks as one-offs | `node scripts/migrate.js` as a job, not inside the web process |

### WHAT HAPPENS if you ignore it?

**Config in code:**
```javascript
// WRONG — committed to Git, exposed in breaches
const dbPassword = 'super-secret-123';
```

**Stateful processes:**
```javascript
// WRONG — breaks clustering, loses data on restart
const sessions = new Map();
app.post('/login', (req, res) => {
  sessions[req.body.userId] = { loggedIn: true };
});
```

**Real consequence:** A startup stored uploaded files in `./uploads`. When they deployed with Docker, the container restarted and all files vanished. They had no backups.

---

## 4. Environment Management

### WHAT are environments?

- **Development (`localhost`):** Where you write code. Hot reload enabled. Verbose logging. Test databases.
- **Staging:** A production clone with synthetic data. Used for QA, demo, and final integration testing.
- **Production:** The real thing. Real users. Real money. Real consequences.

### WHY does staging ≠ production?

Because "it works on my machine" is the most expensive sentence in software.

Differences that have caused production outages:
- Staging uses SQLite; production uses PostgreSQL (different query behavior)
- Staging has 1GB RAM; production has 4GB (memory leaks go unnoticed)
- Staging runs Node 18; production runs Node 16 (different crypto behavior)

### WHAT HAPPENS if environments drift?

**The "It Worked in Staging" Outage:**
A team tested a feature in staging with 100 test users. In production, with 100,000 users, a missing database index caused query timeouts. The feature took down the entire app for 3 hours.

### LATEST Best Practices (2025)

```bash
# .env.development
NODE_ENV=development
DB_HOST=localhost
LOG_LEVEL=debug

# .env.staging
NODE_ENV=staging
DB_HOST=staging-db.internal
LOG_LEVEL=info

# .env.production
NODE_ENV=production
DB_HOST=prod-db.internal
LOG_LEVEL=warn
```

```javascript
// config.js — validate at startup, fail fast
const envalid = require('envalid');

const env = envalid.cleanEnv(process.env, {
  NODE_ENV: envalid.str({ choices: ['development', 'staging', 'production'] }),
  DB_HOST: envalid.host(),
  DB_PASSWORD: envalid.str(),
  PORT: envalid.port({ default: 3000 }),
});

module.exports = env;
```

**Rule:** If `NODE_ENV=production` and a required env var is missing, the app must **crash on startup**. Better to fail at 3 AM during deployment than at 3 PM with users active.

---

## 5. Docker for Node.js

### WHAT is Docker?

Docker packages your application with all dependencies into a **container image** — a portable, immutable artifact that runs identically on your laptop, in CI, and in production.

### WHY do we need it?

Because "works on my machine" is a lie. Different Node.js versions, different OS libraries, different `node_modules` resolutions — Docker eliminates all of it.

### Multi-Stage Builds

```dockerfile
# Stage 1: Build
FROM node:20.11.0-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20.11.0-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Benefits:**
- Final image has no build tools (no `typescript`, no `gcc`)
- `node_modules` contains only production dependencies
- Image size drops from 1.2GB to ~180MB

### Why Alpine is Problematic

```dockerfile
# Tempting, but dangerous
FROM node:20-alpine
```

Alpine Linux uses **musl libc** instead of glibc. This causes subtle, hard-to-debug issues:
- Native Node.js modules (bcrypt, sharp, sqlite3) may fail to compile
- DNS resolution behaves differently (affecting `getaddrinfo`)
- `Math.random()` had a bug in Alpine's musl for years

**LATEST Best Practice (2025):** Use `node:20-slim` (Debian-based) as the balanced choice. It has glibc compatibility, is still relatively small (~100MB vs ~5MB Alpine, vs ~900MB full Debian), and avoids the musl debugging tax.

**When to use Alpine:** Only if you have thoroughly tested all native dependencies and have a specific size constraint (e.g., edge computing).

**When to use Distroless (Google):**
```dockerfile
FROM gcr.io/distroless/nodejs20-debian12
```
- No shell, no package manager, no `curl`, no `ps`
- Smallest attack surface possible
- Best for mature, stable applications where you don't need to debug inside the container

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: devpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**One command to rule them all:**
```bash
docker compose up --build
```

### .dockerignore

```
node_modules
.git
.env
.env.*
coverage
dist
*.md
.github
.vscode
```

### WHAT HAPPENS if Docker is done wrong?

**Security nightmare:**
```dockerfile
# WRONG: Running as root
FROM node:20
# ...
# No USER directive — container runs as root
```

A compromised Node.js app can escape the container and own the host. Always use `USER node`.

**Bloated images:**
Including devDependencies in production increases image size 10x and exposes more CVEs. A 2021 study found 80% of Docker Hub images had known vulnerabilities.

**Unpinned versions:**
```dockerfile
FROM node:latest
```

`node:latest` changes without warning. Your build today uses Node 20; tomorrow it uses Node 22 with breaking changes. Always pin: `node:20.11.0-slim`.

---

## 6. Process Management

### WHAT is process management?

Node.js runs JavaScript on a **single thread**. One Node.js process uses exactly **one CPU core**. On an 8-core server, a single Node.js process wastes 87.5% of CPU capacity.

### WHY do we need clustering?

Because you paid for 8 cores. Use them.

### PM2: The Node.js Process Manager

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'task-api',
    script: './dist/main.js',
    instances: 'max',        // Use all CPU cores
    exec_mode: 'cluster',    // Enable cluster mode
    env: { NODE_ENV: 'production' },
    max_memory_restart: '500M',
    graceful_shutdown: true,
    kill_timeout: 5000,
  }]
};
```

```bash
# Start
pm2 start ecosystem.config.js

# Zero-downtime reload
pm2 reload task-api

# Monitor
pm2 monit

# Save startup script
pm2 startup
pm2 save
```

**What cluster mode does:**
PM2 uses Node.js's built-in `cluster` module to create multiple processes that share the same port. The operating system load-balances incoming TCP connections across these processes.

**Performance impact:** Clustering can increase throughput by **6-8x** on multi-core machines.

**Caveat:** Each process has separate memory. A 500MB app on 8 processes needs 4GB RAM. In-memory state (sessions, caches, WebSockets) must be externalized to Redis or PostgreSQL.

### WHAT HAPPENS without clustering?

**The Single-Core Bottleneck:**
A team running a single Node.js process on a 16-core server hit a wall at 2,000 requests/second. CPU usage sat at 6%. They added PM2 cluster mode and scaled to 12,000 RPS with the same hardware.

**Memory leaks multiplied:**
A slow memory leak in one process is bad. In 8 processes, it's 8x worse. Monitor with `max_memory_restart`.

### Graceful Shutdown: Why SIGTERM Handling Matters

```javascript
const server = app.listen(port);

function gracefulShutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed. No new connections accepted.');
    // Close database connections
    await db.end();
    console.log('Database connections closed.');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### WHAT HAPPENS if you ignore graceful shutdown?

**Data corruption during deployment:**
A payment processing API received `SIGTERM` during a deployment and terminated immediately. A user's payment was debited from their card but the confirmation was never written to the database. The user was charged but received no confirmation email.

**502 errors for users:**
Without graceful shutdown, active requests are dropped mid-flight. During a rolling deployment with 10% of traffic affected, thousands of users see errors.

### systemd Alternative

```ini
# /etc/systemd/system/task-api.service
[Unit]
Description=Task Management API
After=network.target

[Service]
Type=simple
User=node
ExecStart=/usr/bin/node /var/www/app/dist/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/app/.env
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

**When to use what:**
- **VPS, single app:** PM2 for simplicity
- **VPS, multiple apps:** Docker Compose
- **Production server fleet:** systemd + Docker

**Never run production Node.js with `node app.js` in a screen/tmux session.**

---

## 7. Reverse Proxy with Nginx/Caddy

### WHAT is a reverse proxy?

A reverse proxy sits between the internet and your Node.js application. It receives client requests and forwards them to your app.

### WHY you MUST use one

1. **SSL/TLS termination** — Offloads cryptographic work from Node.js
2. **Static file serving** — Nginx serves static files 10x faster than Node.js
3. **Load balancing** — Distribute requests across multiple Node.js processes
4. **Rate limiting and DDoS protection**
5. **Request buffering** — Node.js handles slow clients poorly; proxies buffer the full request
6. **Compression** — gzip/brotli
7. **Security** — Node.js without a proxy is vulnerable to slowloris attacks

### WHAT HAPPENS without a reverse proxy?

**Slowloris attack:**
Attackers open thousands of connections and send data one byte per minute. Node.js's connection pool exhausts. The app stops responding to legitimate users. Nginx buffers and closes these connections.

**Certificate management hell:**
Managing SSL certificates inside Node.js is possible (with `https.createServer()`) but painful. Certificate renewal, cipher configuration, and HSTS headers are better handled by a dedicated proxy.

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/task-api
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static files (bypass Node.js entirely)
    location /static {
        alias /var/www/app/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forward_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

**Critical Express setting when behind a proxy:**
```javascript
app.set('trust proxy', 1); // Trust first proxy (Nginx)
```

### Caddy: The Modern Alternative

```caddyfile
# Caddyfile
api.example.com {
    reverse_proxy localhost:3000
    encode gzip zstd

    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
    }
}
```

**Why Caddy?**
- Automatic HTTPS via Let's Encrypt (zero config)
- Human-readable configuration
- HTTP/3 support out of the box
- Dynamic config changes without restart

**Why Nginx?**
- Battle-tested at massive scale (Cloudflare, Netflix)
- Lower memory footprint
- Massive module ecosystem

### LATEST Best Practices (2025)

- Use **HTTP/2** or **HTTP/3** between client and proxy
- Use **Brotli** compression (15-25% better than gzip)
- Terminate TLS at the proxy; use HTTP between proxy and app
- Set `trust proxy` in Express to get correct client IPs

---

## 8. SSL/TLS with Let's Encrypt

### WHAT is SSL/TLS?

Transport Layer Security (TLS) encrypts data between the browser and your server. Without it, passwords, tokens, and credit cards travel in plain text.

### WHY is it non-negotiable?

- Browsers mark HTTP sites as "Not Secure"
- Search engines penalize HTTP sites in rankings
- Modern APIs require HTTPS for features like Service Workers, geolocation, and camera access

### Let's Encrypt

Let's Encrypt provides free, automated TLS certificates. They're valid for 90 days and renew automatically.

**With Certbot (Nginx):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

**With Caddy:**
Automatic. Zero config. Caddy obtains and renews certificates without any intervention.

### WHAT HAPPENS without SSL?

**Man-in-the-middle attacks:**
On public Wi-Fi, an attacker can intercept unencrypted traffic and steal session cookies. This is called a "session hijacking" attack and takes about 30 seconds with free tools.

**Compliance violations:**
PCI-DSS (payment cards), HIPAA (healthcare), and GDPR all require encryption in transit. Operating without TLS can result in fines.

---

## 9. Logging

### WHY `console.log` is not enough

1. **It's synchronous** — `console.log` blocks the event loop until the output is written
2. **It's unstructured** — Plain text is impossible to query at scale
3. **It has no severity levels** — Everything looks the same
4. **It gets lost** — In Docker containers, stdout logs may vanish when the container restarts

### WHAT HAPPENS with bad logging?

**The 3 AM Mystery:**
A production API returns 500 errors. The only log is:
```
Error: something went wrong
```

No timestamp. No request ID. No stack trace. No user ID. The on-call engineer spends 2 hours reproducing the issue locally.

**Logging bottleneck:**
Under high load, synchronous `console.log` becomes a bottleneck. Each log statement blocks until written to the file descriptor. Throughput drops by 30-50%.

### Structured JSON Logging

Every log line should be a JSON object with standard fields:

```json
{
  "timestamp": "2025-05-06T14:30:00.000Z",
  "level": "error",
  "message": "Database connection failed",
  "service": "task-api",
  "trace_id": "abc-123-def",
  "span_id": "span-456",
  "error": {
    "type": "ConnectionError",
    "code": "ECONNREFUSED",
    "stack": "..."
  },
  "http": {
    "method": "GET",
    "path": "/tasks",
    "status_code": 500,
    "duration_ms": 5234
  },
  "user_id": "user_789"
}
```

### Pino: The Fastest Node.js Logger

```javascript
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined, // In production, output raw JSON
});

// Usage
logger.info({ userId: '123' }, 'User logged in');
logger.error({ err: error }, 'Payment processing failed');

// Express middleware
const pinoHttp = require('pino-http');
app.use(pinoHttp({ logger }));
```

**Why Pino?**
- 5x faster than Winston
- JSON by default
- Low overhead (uses worker threads for I/O)

### Log Aggregation

Logs must be centralized. Options:
- **Cloud:** Datadog, Splunk, Grafana Loki, AWS CloudWatch
- **Self-hosted:** ELK stack (Elasticsearch, Logstash, Kibana)

**Never log:**
- Passwords
- Credit card numbers
- API keys
- JWT tokens
- PII (Personally Identifiable Information)

### LATEST Best Practices (2025)

- Use **correlation IDs** (`x-request-id`) to trace a single request across services
- Log at appropriate levels: `debug` (dev), `info` (normal), `warn` (degraded), `error` (failed)
- Centralize logs from all services into a single queryable system
- Use OpenTelemetry to correlate logs, metrics, and traces

---

## 10. Health Checks

### WHAT is a health check?

An HTTP endpoint (usually `GET /health`) that tells load balancers and orchestrators whether your application is healthy enough to receive traffic.

### WHAT makes a good `/health` endpoint?

```javascript
app.get('/health', async (req, res) => {
  const checks = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: process.env.npm_package_version,
  };

  // Check database connectivity
  try {
    await db.query('SELECT 1');
    checks.database = 'up';
  } catch (err) {
    checks.database = 'down';
    return res.status(503).json({
      status: 'unhealthy',
      checks,
    });
  }

  // Check Redis connectivity
  try {
    await redis.ping();
    checks.redis = 'up';
  } catch (err) {
    checks.redis = 'down';
    return res.status(503).json({ status: 'unhealthy', checks });
  }

  res.json({ status: 'healthy', checks });
});
```

**Types of health checks:**
- **Liveness:** Is the process running? (If not, restart it.)
- **Readiness:** Is the app ready to serve traffic? (If not, remove from load balancer.)
- **Deep health:** Can the app reach its dependencies? (Database, Redis, external APIs.)

### WHY do we need them?

Load balancers and orchestrators (Kubernetes, AWS ECS, Docker Swarm) use health checks to:
- Remove unhealthy instances from traffic rotation
- Restart crashed processes
- Scale based on actual capacity

### WHAT HAPPENS without health checks?

**The Zombie Instance:**
An app's database connection pool exhausted. The API returned 500 errors for every request. But because there was no health check, the load balancer kept sending traffic to it. 50% of users saw errors for 20 minutes until someone manually restarted the instance.

**Deployment catastrophe:**
A new version had a bug that only manifested after 5 minutes (a memory leak). Without readiness checks, the load balancer sent traffic to the new instances immediately. By the time the leak crashed them, 30% of requests had failed.

### LATEST Best Practices (2025)

- Separate `/health/live` (liveness) from `/health/ready` (readiness)
- Keep health checks lightweight (<100ms response time)
- Don't check external services in liveness probes (you'll get restarted when a third party is down)
- Return **503 Service Unavailable** when unhealthy, not 500

---

## 11. CI/CD with GitHub Actions

### WHAT is CI/CD?

- **Continuous Integration (CI):** Automatically build and test code on every commit
- **Continuous Deployment (CD):** Automatically deploy tested code to production

### WHY does it matter?

**Manual deployment risks:**
- Forgetting an environment variable
- Deploying the wrong branch
- Skipping tests because "it's just a small change"
- Only one person knows how to deploy (bus factor = 1)

**The Knight Capital disaster** ($440M loss) was caused by a manual deployment error.

### GitHub Actions Pipeline

```yaml
# .github/workflows/deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: testpassword
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci
      - run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to production
        run: |
          echo "Deploying ${{ github.sha }} to production..."
          # SSH or API call to your server/orchestrator
          # ssh user@server "docker pull ghcr.io/... && docker compose up -d"
```

### WHAT HAPPENS without CI/CD?

**The Friday Deployment:**
A developer deploys manually on Friday at 5 PM. They forget to run migrations. The app crashes. No one is online to fix it. The company loses weekend revenue.

**The Untested Hotfix:**
A critical bug is "fixed" and deployed directly to production to save time. The fix introduces a worse bug. With CI/CD, the test suite would have caught it.

### LATEST Best Practices (2025)

- Use **matrix builds** to test across Node.js 18, 20, and 22
- Use **OIDC** for cloud authentication instead of long-lived credentials
- Require **manual approval** for production deployments
- Implement **blue/green** or **canary** deployments for zero downtime
- Every deployment must be **reversible** in <5 minutes
- Track **DORA metrics**: deployment frequency, lead time, failure rate, MTTR

---

## 12. Serverless Deployment

### WHAT Is Serverless?

Serverless doesn't mean "no servers." It means you don't manage them. You write functions; the platform handles scaling, patching, and capacity.

### Serverless Options for Node.js

| Platform | Best For | Cold Start | Runtime |
|----------|----------|------------|---------|
| **Vercel Functions** | Next.js, full-stack frameworks | Fast | Edge/Node |
| **Cloudflare Workers** | Edge compute, global latency | Near-zero | V8 isolates |
| **AWS Lambda** | AWS-native, event-driven | Medium | Node.js runtime |
| **Netlify Functions** | JAMstack, static sites | Fast | Node.js |
| **Deno Deploy** | Edge, TypeScript-native | Near-zero | Deno |

### Vercel + Express Pattern

```typescript
// api/index.ts
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Vercel adapter
export default app;
```

### Cloudflare Workers

```typescript
// worker.ts
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/users') {
      const users = await env.DB.prepare('SELECT * FROM users').all();
      return Response.json(users.results);
    }
    
    return new Response('Not found', { status: 404 });
  },
};
```

### When to Use Serverless

**Use serverless when:**
- Traffic is sporadic (you pay $0 when idle)
- You need global edge deployment
- You're building API routes alongside a frontend framework
- You want automatic scaling without configuration

**Avoid serverless when:**
- You have long-running processes (>30s on most platforms)
- You need WebSocket connections (use dedicated servers)
- Cold starts are unacceptable (<100ms latency requirement)
- You use native binaries (sharp, bcrypt) that don't compile to WASM

### The Hybrid Approach (2025 Best Practice)

Most modern architectures are hybrid:

```
┌─────────────────────────────────────────────────────────┐
│                     CDN (Vercel/Cloudflare)             │
│              Static assets, edge functions              │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐     ┌──────▼──────┐
   │  API    │      │  Serverless │    │  Long-running │
   │ Routes  │      │  Functions  │    │  Workers      │
   │ (Edge)  │      │  (Vercel)   │    │  (Railway)    │
   └────┬────┘      └─────┬─────┘     └──────┬────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │   (Neon)    │
                    └─────────────┘
```

**Pattern:** Serverless for HTTP request/response. Dedicated servers for background jobs, WebSockets, and heavy computation.

---

## 14. Monitoring Basics

### WHAT should you track?

Google's **Four Golden Signals**:
1. **Latency** — How long do requests take? (p50, p95, p99)
2. **Traffic** — How many requests per second?
3. **Errors** — What percentage of requests fail?
4. **Saturation** — How "full" is your service? (CPU, memory, DB connections)

### Metrics with Prometheus

```javascript
const client = require('prom-client');

// Default metrics (CPU, memory, event loop lag)
client.collectDefaultMetrics();

// Custom HTTP metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

// Metrics endpoint for Prometheus scraper
app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});
```

### Alerting Principles

1. **Alert on symptoms, not causes:**
   - Good: "Payment success rate < 95%"
   - Bad: "CPU > 80%" (CPU can be high during normal batch jobs)

2. **Actionable alerts only:**
   Every alert must have a runbook. If you don't know what to do, it's a dashboard, not an alert.

3. **Severity levels:**
   - **P1 (Page immediately):** Service completely down, data loss, security breach
   - **P2 (Page during business hours):** Degraded performance
   - **P3 (Ticket only):** Capacity warnings

### WHAT HAPPENS without monitoring?

**The Blind Outage:**
A team had no monitoring. Their database connection pool exhausted at 2 AM. Users couldn't log in. The first indication of the problem was an angry tweet at 8 AM. They had been down for 6 hours.

**Alert fatigue:**
A team set up 50 alerts that all fired for every issue. Engineers muted the alerting channel. A critical database disk-full alert was ignored. The database crashed.

### LATEST Best Practices (2025)

- Use **Grafana** for visualization and **Prometheus** for metrics
- Monitor **event loop lag** — it's the #1 indicator of Node.js health
- Monitor **GC pauses** — frequent long pauses indicate memory pressure
- Correlate traces, logs, and metrics using **OpenTelemetry**
- Conduct **Chaos Engineering** (deliberately break things) to test alerting
- Write **blameless postmortems** after every significant outage

---

## 15. Mini Project: Dockerize the Task Management API

### Goal

Take the Task Management API from previous modules and deploy it with:
1. **Docker** multi-stage build
2. **PM2** cluster mode
3. **Nginx** reverse proxy with SSL
4. **GitHub Actions** CI/CD pipeline
5. **Structured logging** with Pino
6. **Health checks** at `/health`
7. **Graceful shutdown** handling

### Project Structure

```
task-api/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── src/
│   ├── app.js
│   ├── routes/
│   ├── controllers/
│   └── db.js
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js
├── nginx.conf
├── .dockerignore
├── .env.example
└── package.json
```

### Step 1: Dockerfile

```dockerfile
# Dockerfile
FROM node:20.11.0-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20.11.0-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

### Step 2: docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_URL=postgres://postgres:password@postgres:5432/tasks
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: tasks
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Step 3: ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'task-api',
    script: './dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '500M',
    graceful_shutdown: true,
    kill_timeout: 5000,
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
  }]
};
```

### Step 4: nginx.conf

```nginx
upstream api {
    server api:3000;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}
```

### Step 5: app.js with Health Checks & Graceful Shutdown

```javascript
const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());

// Health checks
app.get('/health', async (req, res) => {
  const checks = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
  };
  res.json({ status: 'healthy', checks });
});

// Application routes...

const server = app.listen(process.env.PORT || 3000, () => {
  logger.info(`Server running on port ${process.env.PORT || 3000}`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    // Close DB connections here
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Step 6: GitHub Actions Pipeline

Use the pipeline from Section 10. Add a deployment step that SSHs into your server and runs:

```bash
docker compose pull
docker compose up -d
```

### Acceptance Criteria

- [ ] `docker compose up --build` starts the entire stack
- [ ] `curl http://localhost/health` returns 200 with JSON
- [ ] `pm2 monit` shows multiple processes in cluster mode
- [ ] Pushing to `main` triggers the GitHub Actions pipeline
- [ ] Logs are structured JSON with correlation IDs
- [ ] SIGTERM waits for active requests before exiting

---

## Key Takeaways

1. **Start simple.** A VPS with PM2 and Nginx can handle millions of requests.
2. **12-Factor Apps** are portable, scalable, and boring to deploy (which is good).
3. **Docker** eliminates "works on my machine" but requires discipline (pin versions, use non-root, multi-stage).
4. **PM2 cluster mode** is the easiest way to use all CPU cores.
5. **Graceful shutdown** prevents data corruption and 502 errors.
6. **Nginx/Caddy** are mandatory in production for SSL, static files, and security.
7. **Structured logging** turns debugging from art into science.
8. **Health checks** are the difference between auto-healing and manual 3 AM pages.
9. **CI/CD** makes deployment boring, fast, and reversible.
10. **Monitor the Four Golden Signals** — latency, traffic, errors, saturation.

---

*Module 07 - Deployment & DevOps. Latest practices as of 2025.*
