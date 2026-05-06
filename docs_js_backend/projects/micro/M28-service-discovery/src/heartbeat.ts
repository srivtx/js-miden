// Heartbeat cleanup module
// BUG: Cleanup is never started! Dead services remain in the registry forever.

import { getRegistry } from './registry.js';

const TTL = 3000; // 3 seconds for testing

export function cleanup() {
  const now = Date.now();
  const registry = getRegistry();
  // BUG: This function exists but is never called!
  for (let i = registry.length - 1; i >= 0; i--) {
    if (now - registry[i].lastHeartbeat > TTL) {
      console.log(`Removing stale service: ${registry[i].id}`);
      registry.splice(i, 1);
    }
  }
}

export function startCleanup(intervalMs: number = 1500) {
  // BUG: Cleanup interval is never started!
  // setInterval(cleanup, intervalMs);
}
