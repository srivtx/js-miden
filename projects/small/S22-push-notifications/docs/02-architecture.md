# 02-architecture.md

## Components

- **Express Router** (`routes.ts`) — HTTP endpoints for token and notification management
- **Push Service** (`service.ts`) — FCM/APNS mock providers, batch logic
- **In-Memory Store** — tokens and notification history

## Data Flow

1. Client registers device token via `POST /notifications/tokens`
2. Client sends `POST /notifications/send` with token list
3. **BUG:** Service skips token validation and sends to all tokens
4. Each token triggers individual provider call
5. **BUG:** Batch endpoint loops and calls `sendPush` sequentially

## Design Decisions

- Mock providers return success/failure based on token content
- In-memory store allows testing without cloud credentials
- Platform detection uses registered token metadata
