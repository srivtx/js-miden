# MD17: Ride Sharing Platform (Uber Clone)

## Overview

A ride-sharing platform enabling riders to request rides, drivers to accept them, real-time location tracking, dynamic fare calculation, and a rating system.

## Features

- **Ride Requests**: Riders can request rides with pickup/dropoff locations
- **Driver Matching**: Available drivers can accept ride requests
- **Real-time Tracking**: Live location updates during rides
- **Fare Calculation**: Dynamic pricing based on distance, time, and surge multiplier
- **Rating System**: Riders and drivers can rate each other
- **Driver Management**: Availability toggling and location updates

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Rider   │────▶│   Express    │────▶│   Prisma    │
│   App    │◀────│   API (5)    │◀────│  (Postgres) │
└──────────┘     └──────────────┘     └─────────────┘
       │                  │
       │                  ▼
       │           ┌──────────────┐
       └──────────▶│  WebSocket   │
                   │  (Tracking)  │
                   └──────────────┘
```

## Tech Stack

- **Backend**: Express 5, TypeScript (ESM)
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.IO for live tracking
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
| `/api/rides` | POST | Request a new ride |
| `/api/rides/:id` | GET | Get ride details |
| `/api/rides/:id/accept` | PATCH | Driver accepts ride |
| `/api/rides/:id/complete` | PATCH | Complete ride |
| `/api/rides/fare` | GET | Calculate estimated fare |
| `/api/drivers/available` | GET | List available drivers |
| `/api/drivers/:id/location` | PATCH | Update driver location |
| `/api/reviews` | POST | Submit a review |

## Fare Calculation

```
Total Fare = (Base Fare + Distance Fare + Time Fare) × Surge Multiplier

Base Fare = $2.50
Distance Fare = $1.50 per km
Time Fare = $0.35 per minute
Surge Multiplier = 1.0 - 2.5 (based on demand/supply ratio)
```

## Known Issues

See `docs/06-bug-report.md` for detailed bug documentation.
