# Setup: Service Discovery

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/micro/M28-service-discovery
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
| `DISCOVERY_PORT` | 3000 | Port for the discovery server |
| `HEARTBEAT_TTL` | 30000 | Time before a service is considered dead (ms) |
| `CLEANUP_INTERVAL` | 15000 | How often to run cleanup (ms) |

## Verification

```bash
# Register a service
RESPONSE=$(curl -s -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"test-service","url":"http://localhost:9001"}')
echo $RESPONSE

# Extract ID and heartbeat
ID=$(echo $RESPONSE | jq -r '.id')
curl -X POST http://localhost:3000/heartbeat/$ID

# Discover
curl http://localhost:3000/discover/test-service
```
