# Testing

## Test Structure

```
tests/
  game.test.ts   # Matchmaking, state, leaderboard
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Bug Tests

### No State Validation
```typescript
it('should reject impossible health values from client', async () => {
  // Start game session
  // Send health: 999
  // FAILS: Server accepts invalid state
});
```

### Matchmaking Exploits
```typescript
it('should not always match lowest skill players together', async () => {
  // Create smurf account with low rating
  // Queue against beginners
  // Demonstrates exploitability
});
```

## Load Testing

Simulate 1000 concurrent matchmaking requests:
```bash
npx autocannon -c 100 -d 30 http://localhost:3000/api/matchmaking/queue
```
