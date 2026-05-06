# Development Guide

## Setup

```bash
npm install
npm run dev
```

## Project Structure

```
src/
  index.ts          # Entry point
  config.ts         # Configuration
  db.ts             # In-memory store
  middleware/       # Logging
  routes/           # API routes
  types.ts          # TypeScript types
tests/              # Test suites
docs/               # Documentation
```

## Running Tests

```bash
npm test
```

## Debugging Message Loss

The persistence bug is in `src/db.ts`:
- Messages stored in `Map` (in-memory only)
- Fix: Write to append-only log files or use LevelDB

## Debugging Message Ordering

The ordering bug is in `src/routes/queues.ts`:
- `findIndex()` returns first visible message
- Fix: Always take index 0 (oldest) when visible
