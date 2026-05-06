# Setup: Load Balancer

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/micro/M27-load-balancer
npm install
```

## Running the Project

### Development Mode

Terminal 1-3 - Backends:
```bash
npm run dev:backend1
npm run dev:backend2
npm run dev:backend3
```

Terminal 4 - Load Balancer:
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
| `LB_PORT` | 3000 | Port for the load balancer |
| `BACKENDS` | 3001,3002,3003 | Comma-separated backend ports |
| `HEALTH_CHECK_INTERVAL` | 5000 | Health check interval in ms |

## Verification

```bash
# Send multiple requests and observe distribution
for i in {1..6}; do
  curl http://localhost:3000/
done

# Kill one backend and observe errors (due to bug)
```
