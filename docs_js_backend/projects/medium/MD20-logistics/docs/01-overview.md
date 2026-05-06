# MD20: Logistics/Supply Chain Platform

## Overview

A logistics and supply chain management platform for tracking shipments, managing warehouses, optimizing routes, and maintaining inventory across the supply chain.

## Features

- **Shipment Management**: Create and track shipments with unique tracking numbers
- **Real-time Tracking**: Update and monitor shipment locations and statuses
- **Warehouse Management**: Manage warehouse locations and capacities
- **Route Optimization**: Calculate optimal shipping routes (mock implementation)
- **Inventory Management**: Track inventory across warehouses
- **Status Workflow**: Complete shipment lifecycle from creation to delivery

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Prisma    │
│   (Web)     │◀────│   API (5)    │◀────│  (Postgres) │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Tech Stack

- **Backend**: Express 5, TypeScript (ESM)
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Vitest + Supertest
- **Deployment**: Docker Compose

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start database
docker-compose up -d db

# Run migrations
npx prisma migrate dev

# Seed data
npm run db:seed

# Start development
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shipments` | POST | Create shipment |
| `/api/shipments/:id` | GET | Get shipment details |
| `/api/shipments/tracking/:number` | GET | Track by number |
| `/api/shipments/:id/status` | PATCH | Update status |
| `/api/shipments/:id/deliver` | PATCH | Confirm delivery |
| `/api/tracking/:shipmentId` | GET | Get tracking history |
| `/api/warehouses` | GET | List warehouses |
| `/api/routes` | POST | Create route |
| `/api/inventory/:warehouseId` | GET | Get inventory |

## Shipment Status Workflow

```
CREATED → PICKED_UP → IN_TRANSIT → AT_WAREHOUSE → OUT_FOR_DELIVERY → DELIVERED
```

## Known Issues

See `docs/06-bug-report.md` for detailed bug documentation.
