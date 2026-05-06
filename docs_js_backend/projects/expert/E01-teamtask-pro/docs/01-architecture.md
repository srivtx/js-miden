# TeamTask Pro - Architecture Overview

## System Overview
TeamTask Pro is a multi-tenant SaaS project management platform built with a microservices architecture. It supports organizations, role-based access control, real-time notifications, file attachments, and subscription billing.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  (Web App, Mobile, CLI)                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (Port 3000)                    │
│  • Rate Limiting • CORS • Helmet • Request Proxying         │
└──────┬────────┬────────┬────────┬───────────────────────────┘
       │        │        │        │
       ▼        ▼        ▼        ▼
┌─────────┐ ┌─────────┐ ┌─────────────┐ ┌─────────────┐
│  Auth   │ │  Task   │ │ Notification│ │    File     │
│ Service │ │ Service │ │  Service    │ │   Service   │
│ (3001)  │ │ (3002)  │ │   (3003)    │ │   (3004)    │
└────┬────┘ └────┬────┘ └──────┬──────┘ └──────┬──────┘
     │           │             │               │
     └─────┬─────┘             │               │
           │                   │               │
     ┌─────┴─────┐      ┌─────┴─────┐   ┌─────┴─────┐
     │  MongoDB  │      │  Redis    │   │  Storage  │
     │ (Users,   │      │ (Pub/Sub, │   │ (Uploads) │
     │  Orgs)    │      │  Cache)   │   │           │
     └───────────┘      └───────────┘   └───────────┘
```

## Service Responsibilities

### API Gateway
- Single entry point for all client requests
- Rate limiting (100 req/15min per IP)
- Security headers via Helmet
- CORS configuration
- Routes requests to appropriate microservices
- Stripe webhook passthrough

### Auth Service
- User registration and authentication
- JWT token generation and validation
- Organization management
- Role-based access control (owner/admin/member)
- Stripe webhook handling for billing

### Task Service
- Project CRUD operations
- Task CRUD operations with assignments
- Task search and filtering
- Activity logging

### Notification Service
- Server-Sent Events (SSE) for real-time updates
- Redis pub/sub for horizontal scaling
- Connection management

### File Service
- File upload and storage
- MIME type validation
- File size limits (10MB)
- Download with authentication

## Technology Stack
- **Runtime**: Node.js 20, Express 5
- **Language**: TypeScript 5.3 (ESM)
- **Databases**: MongoDB 7, Redis 7
- **Payment**: Stripe
- **Testing**: Vitest, Supertest
