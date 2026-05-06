# TeamTask Pro - Multi-tenant SaaS Project Management

Production-grade multi-tenant SaaS platform with microservices architecture, real-time updates, and subscription billing.

## Architecture

```
                    ┌──────────────┐
                    │   Clients    │
                    └──────┬───────┘
                           │ HTTPS
                    ┌──────▼───────┐
                    │ API Gateway  │
                    │   (3000)     │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────▼─────┐   ┌────▼────┐   ┌─────▼──────┐
     │   Auth    │   │  Task   │   │ Notification│
     │ (3001)    │   │ (3002)  │   │  (3003)     │
     └─────┬─────┘   └────┬────┘   └─────┬──────┘
           │              │              │
     ┌─────▼─────┐   ┌────▼────┐   ┌─────▼──────┐
     │  MongoDB  │   │  Redis  │   │   Redis    │
     │  (Users)  │   │ (Cache) │   │  (Pub/Sub) │
     └───────────┘   └─────────┘   └────────────┘

                    ┌──────────────┐
                    │    File      │
                    │  (3004)      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Local     │
                    │   Storage    │
                    └──────────────┘
```

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| Gateway | 3000 | Routing, rate limiting, security |
| Auth | 3001 | Authentication, orgs, billing webhooks |
| Task | 3002 | Projects, tasks, assignments |
| Notification | 3003 | Real-time SSE updates |
| File | 3004 | File uploads, downloads |

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your secrets

# Start with Docker Compose
docker-compose up -d

# Or run individually
npm run dev:gateway
npm run dev:auth
npm run dev:task
npm run dev:notification
npm run dev:file
```

## API Examples

### Register
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","firstName":"John","lastName":"Doe","organizationName":"Acme"}'
```

### Create Project
```bash
curl -X POST http://localhost:3000/api/v1/tasks/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Website Redesign","description":"New homepage"}'
```

### Real-time Events
```javascript
const eventSource = new EventSource(
  'http://localhost:3000/api/v1/notifications/events?token=<jwt>'
);
eventSource.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Documentation

- [Architecture](docs/01-architecture.md)
- [Multi-Tenancy](docs/02-multi-tenancy.md)
- [Authentication](docs/03-authentication.md)
- [Task Management](docs/04-task-management.md)
- [Real-Time Updates](docs/05-real-time.md)
- [File Storage](docs/06-file-storage.md)
- [Security Audit](docs/07-security.md)
- [Billing](docs/08-billing.md)
- [Deployment](docs/09-deployment.md)

## Known Bugs (Intentional)

This project contains intentional security bugs for training purposes:

1. **Cross-tenant task access**: `GET /tasks/:id` returns tasks from any organization
2. **Cross-tenant search**: `GET /tasks/search` searches across all tenants
3. **SSE event leak**: Real-time events broadcast to all connected clients
4. **File access bypass**: Download endpoint doesn't verify file ownership

See `docs/07-security.md` for details and fixes.

## License
MIT
