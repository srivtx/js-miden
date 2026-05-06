# E05 Social Media Platform — Getting Started

## Prerequisites
- Node.js 20+
- Docker & Docker Compose

## Local Development
```bash
cd docs_js_backend/projects/expert/E05-social-media
# Start all services
docker-compose up --build
```

## Running Individual Services
```bash
cd user-service
npm install
npm run dev
```

## Environment Variables
- `PORT` — Service port
- `JWT_SECRET` — Shared secret for signing tokens

## Testing
```bash
cd user-service
npm test
```
