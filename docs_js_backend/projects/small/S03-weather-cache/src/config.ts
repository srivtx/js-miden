export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const PORT = process.env.PORT || 3000;
export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const REDIS_TTL_SECONDS = 60 * 60; // 1 hour (retention for stale fallback)
export const MOCK_API_DELAY_MS = 100;
