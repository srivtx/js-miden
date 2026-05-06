# 02-architecture.md

## Components

- **Express Router** (`routes.ts`) — HTTP endpoints for email operations
- **Email Service** (`service.ts`) — business logic, SMTP mock, template rendering
- **In-Memory Store** — queues and tracks emails without external dependencies

## Data Flow

1. Client sends `POST /emails/send`
2. Service validates and optionally applies template variables
3. Email is stored with status `queued`
4. **BUG:** Service immediately calls `mockSmtpSend`, blocking for 500ms
5. Status updates to `sent` or `bounced`

## Design Decisions

- In-memory store keeps the project self-contained
- SMTP mock simulates real network latency
- Templates use `{{variable}}` syntax for simplicity
