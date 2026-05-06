import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../../src/utils/circuitBreaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  it('should start in closed state', () => {
    expect(cb.getState()).toBe('closed');
  });

  it('should allow requests when closed', async () => {
    const result = await cb.execute(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should transition to open after threshold failures', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }
    expect(cb.getState()).toBe('open');
  });

  it('should reject requests when open', async () => {
    // Force open state
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    await expect(cb.execute(() => Promise.resolve('success'))).rejects.toThrow(
      "Circuit breaker 'test' is OPEN"
    );
  });

  it('should transition to half-open after timeout', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    expect(cb.getState()).toBe('open');

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(cb.getState()).toBe('half-open');
  });

  it('should transition back to closed after successful half-open calls', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(cb.getState()).toBe('half-open');

    await cb.execute(() => Promise.resolve('success'));
    await cb.execute(() => Promise.resolve('success'));

    expect(cb.getState()).toBe('closed');
  });

  it('should return metrics', async () => {
    const metrics = cb.getMetrics();
    expect(metrics.state).toBe('closed');
    expect(metrics.failureCount).toBe(0);
  });
});
