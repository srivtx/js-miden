import rateLimit from 'express-rate-limit';

export const paymentRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many payment requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many webhook requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
