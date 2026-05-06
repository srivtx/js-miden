# M26: API Gateway Basics

A simple reverse proxy gateway that routes requests to backend services, adds request IDs, and logs traffic.

## Features

- Route `/users/*` to the user service
- Route `/orders/*` to the order service
- Attach unique `X-Request-ID` to every request
- Log all incoming requests with method, path, and request ID

## Bug Introduced

The gateway has **no timeout handling**. If a backend service is slow or unresponsive, the gateway will hang forever instead of returning a 504 Gateway Timeout. This causes client connections to remain open indefinitely and can exhaust server resources.

## Project Structure

```
M26-api-gateway/
├── src/
│   ├── index.ts      # Express server setup
│   ├── gateway.ts    # Proxy logic and routing
│   └── logger.ts     # Request logging middleware
├── tests/
│   └── gateway.test.ts
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
npm run dev    # Start gateway on :3000, backend stubs on :3001/:3002
npm test       # Run tests (some will fail due to the bug)
```

## Services

| Service | Route Prefix | Target Port |
|---------|-------------|-------------|
| Users   | `/users/*`  | 3001        |
| Orders  | `/orders/*` | 3002        |

## Testing the Bug

Run `npm test`. The timeout test will hang or fail because the gateway does not enforce a request timeout.
