# 02-architecture.md

## Components

- **Express Router** (`routes.ts`) — score submission and leaderboard queries
- **Leaderboard Service** (`service.ts`) — score storage, ranking, period filtering
- **In-Memory Array** — simple score storage

## Data Flow

1. Client submits score via `POST /score`
2. Service stores score in array
3. **BUG:** Overwrites existing score without comparing values
4. `GET /leaderboard` filters by period and sorts
5. **BUG:** Full table scan on every request, O(n) complexity

## Design Decisions

- Array storage keeps the project simple and dependency-free
- Period filtering uses timestamp comparison
- Rank is computed dynamically on read
