# MD16: Food Delivery Platform

## Overview

A comprehensive food delivery platform enabling customers to browse restaurants, place orders, track deliveries in real-time, and manage the complete order lifecycle from placement to delivery.

## Features

- **Restaurant Management**: Register restaurants with menus, cuisine types, and locations
- **Menu System**: Dynamic menus with categories, pricing, and availability
- **Order Workflow**: Complete status lifecycle (Placed → Preparing → Ready → Picked Up → Delivered)
- **Real-time Tracking**: Live driver location updates with ETA calculation
- **Driver Management**: Driver availability, assignment, and location tracking
- **Order Assignment**: Automated and manual driver assignment

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Prisma    │
│  (Mobile)   │◀────│   API (5)    │◀────│  (Postgres) │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  WebSocket   │
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
| `/api/restaurants` | GET | List all restaurants |
| `/api/restaurants/:id` | GET | Get restaurant details |
| `/api/restaurants/:id/menu` | GET | Get restaurant menu |
| `/api/orders` | POST | Create new order |
| `/api/orders/:id` | GET | Get order details |
| `/api/orders/:id/status` | PATCH | Update order status |
| `/api/orders/:id/assign` | PATCH | Assign driver to order |
| `/api/drivers/available` | GET | List available drivers |
| `/api/tracking/:orderId` | GET | Get order tracking |

## Order Status Workflow

```
PLACED → PREPARING → READY → PICKED_UP → DELIVERED
   │          │         │          │           │
   └──────────┴─────────┴──────────┴───────────┘
                    OR
   └────────── CANCELLED (from any state)
```

## ETA Calculation

ETA is calculated using the Haversine formula for distance calculation between driver and destination, assuming an average urban speed of 30 km/h.

## Known Issues

See `docs/06-bug-report.md` for detailed bug documentation.
