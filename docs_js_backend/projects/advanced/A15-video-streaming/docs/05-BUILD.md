# Build & Run

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose (optional)

## Local Development

```bash
cd A15-video-streaming
npm install
npm run dev
```

Server starts on http://localhost:3000

## Running Tests

```bash
npm test
```

Tests cover:
- Video CRUD operations
- Upload session flow
- Range request behavior (including bug reproduction)

## Docker

```bash
docker-compose up -d
```

Services:
- `app`: Express server
- `redis`: Session and rate limit store
- `cdn`: Nginx origin shield
- `transcoder`: FFmpeg worker stub

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| STORAGE_PATH | ./data/videos | Video storage directory |
| CDN_BASE_URL | http://localhost:8080 | CDN origin URL |
| REDIS_URL | redis://localhost:6379 | Redis connection |
| MAX_UPLOAD_SIZE | 1GB | Maximum upload size |

## Project Structure

```
src/
  index.ts              # Application entry
  config.ts             # Environment configuration
  routes/               # Express routers
  controllers/          # Request handlers
  services/             # Business logic
  middleware/           # Express middleware
  types/                # TypeScript interfaces
  utils/                # Helpers
tests/                  # Vitest test suite
docs/                   # Documentation
```
