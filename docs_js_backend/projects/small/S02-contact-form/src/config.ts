export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const PORT = process.env.PORT || 3000;
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
