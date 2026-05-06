# Testing Guide

## Run Tests

```bash
npm test
```

## Test Coverage

- **Registration**: Validates webhook creation
- **Event Fan-out**: Confirms events queue to matching webhooks
- **Signature**: Verifies `sendWebhook` generates HMAC headers
- **Logs**: Checks delivery log retrieval

## Mocking External Calls

Use `vi.spyOn(sender, 'sendWebhook')` to mock delivery in unit tests. Integration tests can spin up a local HTTP server to receive webhooks.

## Example Mock

```typescript
import * as sender from '../src/services/sender.js';
const sendSpy = vi.spyOn(sender, 'sendWebhook').mockResolvedValue();
```
