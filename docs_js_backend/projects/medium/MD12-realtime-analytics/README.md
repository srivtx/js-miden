# MD12: Real-time Analytics

Real-time analytics platform with event ingestion, Redis aggregation, and time-series dashboard API.

## Features

- Event Ingestion API
- Redis Real-time Aggregation
- Time-series Dashboard
- Tumbling/Sliding Windows
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

### Race Condition in Aggregation (BUG)
Concurrent event processing uses non-atomic read-modify-write, causing lost updates.

### No Window Cleanup (BUG)
Old window data is never purged, leading to unbounded storage growth.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations

## License

MIT