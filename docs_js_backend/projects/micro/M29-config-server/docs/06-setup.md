# Setup: Config Server

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/micro/M29-config-server
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
| `CONFIG_PORT` | 3000 | Port for the config server |

## Verification

```bash
# Set dev config
curl -X POST http://localhost:3000/config/myapp/dev \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"localhost","debug":true}'

# Set prod config
curl -X POST http://localhost:3000/config/myapp/prod \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"prod-db.example.com","debug":false}'

# Get dev config
curl http://localhost:3000/config/myapp/dev

# Get prod config
curl http://localhost:3000/config/myapp/prod

# Due to the bug, both will return the same value!
```
