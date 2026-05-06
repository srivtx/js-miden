# Setup: Bulkhead Pattern

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/micro/M30-bulkhead
npm install
```

## Running the Project

### Development Mode

```bash
npm run dev
```

### Build and Run

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BULKHEAD_PORT` | 3000 | Port for the bulkhead server |
| `POOL_A_MAX` | 3 | Max concurrent critical requests |
| `POOL_B_MAX` | 3 | Max concurrent background jobs |

## Verification

```bash
# Send a critical request
curl http://localhost:3000/critical

# Send a background request
curl http://localhost:3000/background

# Test isolation: flood background and then send critical
# Due to the bug, the critical request may be rejected!
```
