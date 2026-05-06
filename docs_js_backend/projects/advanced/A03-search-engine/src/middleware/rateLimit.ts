import rateLimit from 'express-rate-limit';

export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many search requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const indexRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many index requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
