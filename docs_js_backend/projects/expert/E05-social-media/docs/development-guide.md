# E05 Social Media Platform — Development Guide

## Code Style
- TypeScript with ESM (`"type": "module"`)
- Strict mode enabled
- Express 5 error handling with 4-arity middleware

## Adding a Service
1. Create directory with `src/`, `tests/`, `package.json`, `tsconfig.json`, `Dockerfile`
2. Add service to `docker-compose.yml`
3. Assign unique port

## Cross-Service Calls
Use `fetch` or `axios` with service names as hostnames in Docker network.
Example: `http://user-service:3001/users/:id`

## Environment Variables
Never commit secrets. Use `.env` files ignored by git.

## Logging
Use `console.error` for errors. In production, switch to structured logging (Pino/Winston).
