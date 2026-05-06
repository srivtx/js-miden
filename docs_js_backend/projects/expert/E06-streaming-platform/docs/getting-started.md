# E06 Streaming Platform — Getting Started

## Prerequisites
- Node.js 20+
- Docker & Docker Compose

## Local Development
```bash
cd docs_js_backend/projects/expert/E06-streaming-platform
docker-compose up --build
```

## Individual Service
```bash
cd stream-service
npm install
npm run dev
```

## Environment Variables
- `PORT` — Service port
- `JWT_SECRET` — Shared signing secret

## Testing
```bash
cd stream-service
npm test
```
