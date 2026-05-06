import { Pool } from './pool.js';

// BUG: Both 'critical' and 'background' use the SAME shared pool!
// This defeats the purpose of the bulkhead pattern.
const sharedPool = new Pool('shared', 3);

export async function executeWithPool<T>(poolName: string, fn: () => Promise<T>): Promise<T> {
  // BUG: poolName is ignored; everything uses sharedPool
  if (!sharedPool.hasCapacity()) {
    throw new Error('Pool is full');
  }

  sharedPool.acquire();
  try {
    return await fn();
  } finally {
    sharedPool.release();
  }
}

export function getPoolStatus() {
  return {
    max: sharedPool.getMax(),
    active: sharedPool.getActive(),
  };
}
