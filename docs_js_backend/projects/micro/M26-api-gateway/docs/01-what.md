# WHAT: API Gateway Basics

An API Gateway is a single entry point for all client requests to a microservices architecture. Instead of clients talking directly to individual services, they talk to the gateway, which routes requests to the appropriate backend service.

## Core Responsibilities

1. **Reverse Proxying**: Forward client requests to backend services and return the responses.
2. **Routing**: Map URL paths to specific services (e.g., `/users/*` → User Service).
3. **Request Identification**: Attach unique identifiers to each request for tracing and debugging.
4. **Logging**: Record all traffic for observability and auditing.

## What This Project Does

This project implements a minimal API gateway in Express.js that:

- Listens on port 3000
- Proxies `/users/*` to a user service on port 3001
- Proxies `/orders/*` to an order service on port 3002
- Generates a UUID for every incoming request in the `X-Request-ID` header
- Logs the method, path, request ID, and target URL for every request

## Simplified Architecture

```
Client
  │
  ▼
┌─────────────┐
│   Gateway   │  ← Adds X-Request-ID, logs request
│   :3000     │
└─────────────┘
  │         │
  ▼         ▼
┌─────┐   ┌─────┐
│User │   │Order│
│:3001│   │:3002│
└─────┘   └─────┘
```

## Key Terms

| Term | Definition |
|------|------------|
| Reverse Proxy | A server that sits between clients and backends, forwarding requests and responses. |
| Request ID | A unique identifier attached to a request for correlation across services. |
| Route | A URL pattern that determines which backend service handles a request. |
