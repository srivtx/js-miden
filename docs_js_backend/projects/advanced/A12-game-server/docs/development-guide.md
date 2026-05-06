# Development Guide

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
src/
  index.ts              # Express app
  config.ts             # Environment config
  types.ts              # TypeScript types
  db.ts                 # In-memory storage
  middleware/
    auth.ts             # JWT middleware
  routes/
    matchmaking.ts      # Player registration, queue
    game.ts             # State updates, finish
    leaderboard.ts      # Rankings
  services/
    matchmaker.ts       # Skill-based matching
    gameState.ts        # State management
    antiCheat.ts        # Validation & leaderboard
```

## Adding New Game Mode

1. Define mode in `types.ts`
2. Update `matchmaker.ts` to support mode-specific queues
3. Add validation rules in `gameState.ts`
4. Update leaderboard scoring in `antiCheat.ts`

## Testing Matchmaking

```typescript
// Create players with different ratings
// Queue them
// Assert expected matches
```
