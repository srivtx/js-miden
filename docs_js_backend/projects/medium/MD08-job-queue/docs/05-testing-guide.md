# Testing Guide

## Run Tests

```bash
npm test
```

## Test Coverage

- **Job Creation**: Validates transcode job creation
- **Idempotency**: Confirms duplicate payloads return cached results
- **Status Polling**: Checks job details and progress endpoints

## Mocking BullMQ

For unit tests, mock `addTranscodeJob` to avoid requiring Redis:

```typescript
vi.mock('../src/queue.js', () => ({
  addTranscodeJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));
```

## Integration Testing

Integration tests require PostgreSQL and Redis running:

```bash
npm run db:up
npm test
```

## Simulating Failures

To test retry logic, temporarily break the `transcodeVideo` function to throw errors. Verify that `attempt_count` increments and the job eventually reaches `dead` status.
