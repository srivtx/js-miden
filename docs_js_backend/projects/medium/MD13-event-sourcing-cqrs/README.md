# MD13: Event Sourcing + CQRS

E-commerce platform with event sourcing and CQRS: separate read/write models with PostgreSQL event store.

## Features

- Event Sourcing with PostgreSQL
- CQRS Pattern Implementation
- Command Handlers (PlaceOrder, CancelOrder)
- Event Store with Versioning
- Async Projections
- Snapshot Support
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

### Direct Read from Write Model (BUG)
The `getByIdFromEventStore` method queries the event store directly, defeating CQRS separation.

### Eventual Consistency Gap (BUG)
After placing an order, the read model may not reflect the change immediately.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations

## License

MIT