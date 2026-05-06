# MD11: GraphQL Server (Production)

Production GraphQL server with schema stitching, DataLoader, query complexity analysis, persisted queries, and subscriptions.

## Features

- Schema Stitching with @graphql-tools/stitch
- DataLoader for N+1 query prevention
- Query Complexity Analysis
- Persisted Queries
- GraphQL Subscriptions via WebSocket
- PostgreSQL + Redis
- TypeScript + ESM

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm run db:migrate
npm run dev
```

## Documentation

- [Architecture](./docs/architecture.md)
- [API](./docs/api.md)
- [Data Model](./docs/data-model.md)
- [Setup](./docs/setup.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Security](./docs/security.md)
- [Performance](./docs/performance.md)

## Known Issues

### Query Depth Limit Disabled (BUG)
The query depth limiter is intentionally disabled, allowing recursive queries that can crash the server.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations

## License

MIT