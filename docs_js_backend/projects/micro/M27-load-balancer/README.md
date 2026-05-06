# M27: Load Balancer

A round-robin load balancer that distributes HTTP requests across multiple backend servers with health checking.

## Features

- Round-robin request distribution across 3 backend servers
- Periodic health checks to detect unhealthy backends
- Automatically remove failed backends from the rotation
- Restore backends when they become healthy again

## Bug Introduced

The load balancer has **no health checks**. It blindly sends requests to all configured backends, including those that are down or unresponsive. This results in 50x errors being returned to clients whenever a dead server is chosen.

## Project Structure

```
M27-load-balancer/
├── src/
│   ├── index.ts      # Express server setup
│   ├── balancer.ts   # Round-robin and health check logic
│   └── health.ts     # Health check implementation
├── tests/
│   └── balancer.test.ts
├── docs/
│   ├── 01-what.md
│   ├── 02-why.md
│   ├── 03-how.md
│   ├── 04-wrong-vs-right.md
│   ├── 05-architecture.md
│   ├── 06-setup.md
│   ├── 07-testing.md
│   ├── 08-troubleshooting.md
│   └── 09-reference.md
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

```bash
npm install
npm run dev    # Start load balancer on :3000, 3 backends on :3001-3003
npm test       # Run tests (some will fail due to the bug)
```

## Backends

| Backend | Port | Status |
|---------|------|--------|
| Server 1 | 3001 | Healthy |
| Server 2 | 3002 | Healthy |
| Server 3 | 3003 | Healthy |

## Testing the Bug

Run `npm test`. Tests that simulate a backend failure will fail because the balancer continues to route traffic to dead servers.
