// BUGGY CACHE IMPLEMENTATION
// Issues:
// 1. Uses plain Map with no size limit (memory leak under load)
// 2. Creates a setTimeout per key but NEVER clears it on overwrite or delete
//    - Overwriting a key creates a new timer, old timer still fires and deletes new value
//    - Deleting a key leaves orphaned timer in memory
//    - Memory leaks from both unbounded Map and accumulated timers

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  set(key: string, value: T): void {
    const expiresAt = Date.now() + this.ttlMs;

    // BUG: We create a setTimeout but never store/clear it.
    // If the key is overwritten or deleted before TTL, this timer still fires
    // and may incorrectly remove a newer value, or leave an orphaned function
    // reference in memory.
    setTimeout(() => {
      this.store.delete(key);
    }, this.ttlMs);

    this.store.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Lazy expiration check on access
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  delete(key: string): boolean {
    // BUG: Timer is NOT cleared here. The timer still exists in memory
    // and will attempt to delete from the Map later.
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  size(): number {
    // BUG: Includes expired entries that haven't been accessed yet
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  // Helper to expose internal state for tests
  _internalStore(): Map<string, CacheEntry<T>> {
    return this.store;
  }
}

export const cache = new SimpleCache<unknown>(60);
