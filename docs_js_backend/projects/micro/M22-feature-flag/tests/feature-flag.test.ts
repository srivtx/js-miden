import request from 'supertest';
import { app, service } from '../src/index.js';

describe('Feature Flag', () => {
  beforeEach(() => {
    service.setFlag({ name: 'test-flag', enabled: true, rolloutPercentage: 50 });
  });

  it('should return disabled for non-existent flag', async () => {
    const res = await request(app).get('/flags/nonexistent');
    expect(res.body.enabled).toBe(false);
  });

  it('should return consistent result for same user', async () => {
    const userId = 'user-123';
    const results: boolean[] = [];

    // Same user should always get same result
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get(`/flags/test-flag?userId=${userId}`);
      results.push(res.body.enabled);
    }

    const allSame = results.every(r => r === results[0]);
    expect(allSame).toBe(true);
  });

  it('should allow user-specific override', async () => {
    service.setFlag({
      name: 'test-flag',
      enabled: true,
      rolloutPercentage: 0,
      userIds: ['admin-1'],
    });

    const res = await request(app).get('/flags/test-flag?userId=admin-1');
    expect(res.body.enabled).toBe(true);
  });

  it('should respect disabled flag', async () => {
    service.setFlag({ name: 'disabled-flag', enabled: false, rolloutPercentage: 100 });
    const res = await request(app).get('/flags/disabled-flag?userId=anyone');
    expect(res.body.enabled).toBe(false);
  });

  it('should support gradual percentage rollout', async () => {
    service.setFlag({ name: 'gradual', enabled: true, rolloutPercentage: 10 });

    let enabledCount = 0;
    const totalUsers = 100;

    for (let i = 0; i < totalUsers; i++) {
      const res = await request(app).get(`/flags/gradual?userId=user-${i}`);
      if (res.body.enabled) enabledCount++;
    }

    // Should be roughly 10% with consistent hashing
    const percentage = (enabledCount / totalUsers) * 100;
    expect(percentage).toBeGreaterThanOrEqual(5);
    expect(percentage).toBeLessThanOrEqual(15);
  });
});
