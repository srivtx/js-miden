# Build & Run

## Prerequisites
- Node.js >= 20
- Docker Engine (for sandbox stub)
- npm or pnpm

## Installation
```bash
npm install
```

## Development
```bash
npm run dev
```
Uses `tsx watch` for hot reload. Listens on port 3000 by default, or 3005 via docker-compose.

## Build
```bash
npm run build
```
Compiles TypeScript to `dist/`.

## Tests
```bash
npm run test
```
Runs Vitest. Tests use a local spawn stub instead of Docker to avoid daemon dependency.

## Docker Compose
```bash
docker-compose up
```
Starts the API and Redis services.

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `EXECUTION_TIMEOUT_MS` | 2000 | Wall-clock time limit per submission |
| `EXECUTION_MEMORY_MB` | 256 | Memory limit passed to sandbox |
| `MAX_OUTPUT_BYTES` | *not set* | **Intentionally missing** |
| `DOCKER_IMAGE_JS` | `node:20-alpine` | Image for JS runner |
| `DOCKER_IMAGE_PY` | `python:3.12-alpine` | Image for Python runner |
| `DOCKER_IMAGE_GO` | `golang:1.22-alpine` | Image for Go runner |
