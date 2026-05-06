# Testing Guide

## Test Structure

```
tests/
├── signaling.test.ts    # Core signaling logic
├── room.test.ts         # Room management
├── ice.test.ts          # ICE relay (contains bug test)
└── presence.test.ts     # Presence tracking
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npx vitest run --coverage
```

## Test Categories

### Unit Tests

Test individual services in isolation:

```typescript
import { SignalingService } from '../src/services/SignalingService.js';

describe('SignalingService', () => {
  it('should isolate rooms', () => {
    // Peers in different rooms should NOT receive each other's messages
  });
});
```

### Integration Tests

Test WebSocket message flow:

```typescript
it('should relay SDP offer to target peer', () => {
  // 1. Connect two peers
  // 2. Send offer from peer-1 to peer-2
  // 3. Assert peer-2 receives the offer
});
```

### Bug Regression Tests

The ICE candidate memory leak is documented with a failing test:

```typescript
it('BUG: ICE candidates accumulate forever - memory leak', () => {
  for (let i = 0; i < 1000; i++) {
    iceService.relayCandidate('room-1', 'peer-1', candidate);
  }
  expect(iceService.getCandidateCount()).toBe(1000); // Bug: never cleaned
});
```

## Load Testing

Use `artillery` or `k6` for WebSocket load testing:

```bash
npm install -g artillery
artillery quick --count 100 --num 50 ws://localhost:3000
```

## References

[1] Vitest Documentation. https://vitest.dev/
[2] WebSocket Testing Best Practices, 2023.