# Setup: API Gateway Basics

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/micro/M26-api-gateway
npm install
```

## Running the Project

### Option 1: Development Mode (recommended)

Terminal 1 - User Service:
```bash
npm run dev:user
```

Terminal 2 - Order Service:
```bash
npm run dev:order
```

Terminal 3 - Gateway:
```bash
npm run dev:gateway
```

### Option 2: Build and Run

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | 3000 | Port for the gateway |
| `USER_SERVICE_URL` | http://localhost:3001 | User service target |
| `ORDER_SERVICE_URL` | http://localhost:3002 | Order service target |

## Verification

```bash
# Should proxy to user service
curl -i http://localhost:3000/users/profile
# X-Request-ID header should be present in response

# Should proxy to order service
curl -i http://localhost:3000/orders/123
```
