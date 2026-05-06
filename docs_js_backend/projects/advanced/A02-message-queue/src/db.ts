import type { Message, Queue, Topic } from '../types.js';

// In-memory store - BUG: not persisted to disk
export const queues = new Map<string, Queue>();
export const topics = new Map<string, Topic>();

export function resetDb() {
  queues.clear();
  topics.clear();
}
