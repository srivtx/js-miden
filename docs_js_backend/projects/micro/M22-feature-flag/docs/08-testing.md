# Testing: Feature Flag

## Test Strategy

### Unit Tests

Test flag evaluation logic:

```typescript
describe('FeatureFlagService', () => {
  it('returns false for missing flag', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('missing')).toBe(false);
  });

  it('returns consistent result for same user', () => {
    const service = new FeatureFlagService();
    service.setFlag({ name: 'test', enabled: true, rolloutPercentage: 50 });

    const results = Array.from({ length: 100 }, () =>
      service.isEnabled('test', 'user-123')
    );

    expect(new Set(results).size).toBe(1); // All same
  });

  it('respects user override', () => {
    const service = new FeatureFlagService();
    service.setFlag({
      name: 'test',
      enabled: true,
      rolloutPercentage: 0,
      userIds: ['admin'],
    });

    expect(service.isEnabled('test', 'admin')).toBe(true);
    expect(service.isEnabled('test', 'other')).toBe(false);
  });
});
```

### Percentage Tests

```typescript
it('rollout percentage is accurate', () => {
  const service = new FeatureFlagService();
  service.setFlag({ name: 'test', enabled: true, rolloutPercentage: 10 });

  let enabled = 0;
  for (let i = 0; i < 1000; i++) {
    if (service.isEnabled('test', `user-${i}`)) enabled++;
  }

  const percentage = (enabled / 1000) * 100;
  expect(percentage).toBeGreaterThanOrEqual(8);
  expect(percentage).toBeLessThanOrEqual(12);
});
```

### Integration Tests

```typescript
it('GET /flags/:flag returns correct result', async () => {
  const res = await request(app).get('/flags/dark-mode?userId=abc');
  expect(res.body).toHaveProperty('enabled');
  expect(res.body).toHaveProperty('flag', 'dark-mode');
});
```

### Persistence Tests

```typescript
it('survives restart', async () => {
  await request(app)
    .post('/flags/new-feature')
    .send({ enabled: true, rolloutPercentage: 100 });

  // Simulate restart by creating new service
  const newService = new FeatureFlagService();
  await newService.load();

  expect(newService.isEnabled('new-feature')).toBe(true);
});
```

## Test Checklist

- [ ] Missing flag returns false
- [ ] Disabled flag returns false
- [ ] Consistent hashing works
- [ ] Rollout percentage is accurate
- [ ] User overrides work
- [ ] Persistence survives restart
- [ ] Performance < 1ms per evaluation
