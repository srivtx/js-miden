import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { increment, getCount } from '../src/counter.js';

const redis = new Redis();

describe('Counter API', () => {
  beforeEach(async () => {
    await redis.del('counter');
  });

  test('increment returns sequential values', async () => {
    const v1 = await increment();
    const v2 = await increment();
    assert.strictEqual(v1, 1);
    assert.strictEqual(v2, 2);
  });

  test('getCount returns current value', async () => {
    await increment();
    await increment();
    const count = await getCount();
    assert.strictEqual(count, 2);
  });

  test('100 concurrent increments should equal 100', async () => {
    const promises = Array.from({ length: 100 }, () => increment());
    await Promise.all(promises);
    const count = await getCount();
    assert.strictEqual(count, 100);
  });
});
