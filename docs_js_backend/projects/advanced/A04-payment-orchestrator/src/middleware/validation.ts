import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const createPaymentSchema = z.object({
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).toUpperCase(),
  description: z.string().min(1).max(500),
  customerEmail: z.string().email(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string()).optional(),
});

export const validateCreatePayment = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    createPaymentSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

const webhookSchema = z.object({
  provider: z.enum(['stripe', 'paypal']),
  eventType: z.string(),
  transactionId: z.string(),
  status: z.enum(['pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed']),
  metadata: z.record(z.unknown()).optional(),
});

export const validateWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    webhookSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};
