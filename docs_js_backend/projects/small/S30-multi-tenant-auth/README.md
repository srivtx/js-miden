# S30 Multi-Tenant Auth

SaaS-style multi-tenant authentication with tenant isolation, JWT tenant claims, and role-based access.

## Features

- Tenant isolation via subdomain or header
- JWT with tenant claim
- Role-based access control per tenant
- Tenant-specific PostgreSQL schemas

## Intentional Bug

JWT tenant claim is not validated on incoming requests, allowing a user from Tenant A to access Tenant B using the same user ID.

## Scripts

```bash
npm run dev       # Start development server
npm test          # Run Vitest tests (includes bug reproduction)
npm run build     # Compile TypeScript
```

## Docker

```bash
docker-compose up -d
```
