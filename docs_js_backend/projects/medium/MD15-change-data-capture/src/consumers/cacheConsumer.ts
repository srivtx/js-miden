import type { ChangeEvent } from '../types.js';

// Simulated cache consumer
const cache = new Map<string, unknown>();

export async function handleCacheUpdate(event: ChangeEvent): Promise<void> {
  if (event.table === 'users') {
    if (event.operation === 'INSERT' || event.operation === 'UPDATE') {
      cache.set(`user:${event.after?.id}`, event.after);
    } else if (event.operation === 'DELETE') {
      cache.delete(`user:${event.before?.id}`);
    }
  }

  if (event.table === 'orders') {
    if (event.operation === 'INSERT' || event.operation === 'UPDATE') {
      cache.set(`order:${event.after?.id}`, event.after);
    } else if (event.operation === 'DELETE') {
      cache.delete(`order:${event.before?.id}`);
    }
  }
}

export function getCache(): Map<string, unknown> {
  return cache;
}

export function clearCache(): void {
  cache.clear();
}
