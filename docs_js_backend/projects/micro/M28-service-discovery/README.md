# M28: Service Discovery

A service registry where microservices can register themselves, send heartbeats, and be discovered by other services.

## Features

- `POST /register` - Register a service with name and URL
- `GET /discover/:name` - Discover all healthy instances of a service
- `POST /heartbeat/:id` - Send heartbeat to keep registration alive
- Automatic cleanup of dead services that miss heartbeats

## Bug Introduced

The registry has **no heartbeat cleanup**. Services that crash or are shut down never get removed from the registry. Over time, the registry fills with stale entries, and clients discover URLs that no longer exist.

## Project Structure

```
M28-service-discovery/
├── src/
│   ├── index.ts      # Express server setup
│   ├── registry.ts   # Service registry logic
│   └── heartbeat.ts  # Heartbeat and cleanup logic
├── tests/
│   └── registry.test.ts
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
npm run dev    # Start discovery server on :3000
npm test       # Run tests (some will fail due to the bug)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/register` | Register a new service instance |
| GET    | `/discover/:name` | Get all instances of a service |
| POST   | `/heartbeat/:id` | Renew a service's lease |

## Testing the Bug

Run `npm test`. The stale cleanup test will fail because dead services remain in the registry indefinitely.
