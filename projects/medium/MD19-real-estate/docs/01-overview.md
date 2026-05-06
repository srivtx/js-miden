# MD19: Real Estate Platform

## Overview

A real estate platform for property listings, advanced search, tour bookings, agent matching, and mortgage calculations.

## Features

- **Property Listings**: Create and manage property listings with details
- **Advanced Search**: Filter by location, price, beds, baths, property type
- **Geospatial Search**: Find properties within a radius
- **Tour Bookings**: Schedule property viewings
- **Agent Matching**: Match with nearby agents
- **Mortgage Calculator**: Estimate monthly payments

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
| `/api/listings` | GET | List all properties |
| `/api/listings/:id` | GET | Get property details |
| `/api/search` | GET | Search properties |
| `/api/search/nearby` | GET | Find nearby properties |
| `/api/tours` | POST | Book a tour |
| `/api/agents` | GET | List agents |
| `/api/agents/match` | GET | Match with agent |
| `/api/calculator/mortgage` | GET | Calculate mortgage |

## Known Issues

See `docs/06-bug-report.md` for detailed bug documentation.
