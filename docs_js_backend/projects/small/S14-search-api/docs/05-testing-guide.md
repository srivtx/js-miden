# Testing Guide

## Run Tests

```bash
npm test
```

## Test Coverage

- **Indexing**: Validates document creation with required fields
- **Stemming**: Verifies "run" matches "running", "runners"
- **Highlights**: Confirms `<mark>` tags wrap matched terms
- **Pagination**: Tests limit/page parameters and total count

## Mocking PostgreSQL

Tests connect to the real PostgreSQL container defined in `docker-compose.yml`. For CI, ensure `DB_HOST=localhost` and the container is running.

## Writing New Tests

```typescript
it('filters by phrase', async () => {
  await request(app).post('/api/index').send({ title: 'A', content: 'exact phrase here' });
  const res = await request(app).get('/api/search?q="exact phrase"');
  expect(res.body.results.length).toBe(1);
});
```
