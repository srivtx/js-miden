# Testing: Config Manager

## Test Strategy

### Unit Tests

Test config manager in isolation:

```typescript
describe('ConfigManager', () => {
  it('sets and gets values', async () => {
    const manager = new ConfigManager('./test.json');
    await manager.set('key', 'value');
    expect(manager.get('key')).toBe('value');
  });

  it('validates types', async () => {
    const manager = new ConfigManager('./test.json');
    manager.addSchema('port', { type: 'number' });

    await expect(
      manager.set('port', 'not-a-number')
    ).rejects.toThrow('Expected number');
  });
});
```

### Integration Tests

```typescript
it('POST /config stores value', async () => {
  await request(app)
    .post('/config')
    .send({ key: 'timeout', value: 5000 });

  const res = await request(app).get('/config/timeout');
  expect(res.body.value).toBe(5000);
});

it('GET /config returns all values', async () => {
  await request(app)
    .post('/config')
    .send({ key: 'a', value: 1 });

  const res = await request(app).get('/config');
  expect(res.body.a).toBe(1);
});
```

### Validation Tests

```typescript
it('rejects invalid config', async () => {
  const res = await request(app)
    .post('/config')
    .send({ key: 'port', value: 'not-a-number' });

  expect(res.status).toBe(400);
});
```

### Atomicity Tests

```typescript
it('does not corrupt on crash', async () => {
  const manager = new ConfigManager('./test.json');
  await manager.set('key', 'value');

  // Verify temp file doesn't exist
  expect(
    fs.existsSync('./test.json.tmp')
  ).toBe(false);

  // Verify main file is valid JSON
  const data = await fs.readFile('./test.json', 'utf-8');
  expect(() => JSON.parse(data)).not.toThrow();
});
```

## Test Checklist

- [ ] Can set and get values
- [ ] Returns 404 for missing keys
- [ ] Validates types
- [ ] Validates ranges
- [ ] Bulk updates work
- [ ] Atomic writes
- [ ] Survives crash
- [ ] Hot reload works
- [ ] Rejects invalid JSON
