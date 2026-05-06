# Testing Guide

## Run Tests

```bash
npm test
```

## Test Coverage

- **Moderation**: Rejects known prompt injection patterns
- **Generation**: Validates SSE headers and safe prompt acceptance
- **Search**: Confirms text similarity search returns relevant results

## Mocking OpenAI

For unit tests without API keys, mock `openai.chat.completions.create`:

```typescript
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          async *[Symbol.asyncIterator]() {
            yield { choices: [{ delta: { content: 'Hello' } }] };
          }
        })
      }
    };
  }
}));
```

## Environment

Tests use a local PostgreSQL container. Ensure `DB_PORT=5434` is available.
