import { Router, Request, Response } from 'express';
import { validateContact } from '../middleware/validator.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// BUG: Rate limiter middleware is imported but NOT applied to this route.
// This leaves the endpoint vulnerable to spam.
router.post('/contact', validateContact, (req: Request, res: Response) => {
  const body = (req as any).sanitizedBody || req.body;

  // Log email to console (no actual email service)
  console.log('--- NEW CONTACT FORM SUBMISSION ---');
  console.log(`From: ${body.name} <${body.email}>`);
  console.log(`Message: ${body.message}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('-----------------------------------');

  // GDPR: We don't store data in a database. Logs are ephemeral.
  // In production, logs should rotate and not retain PII indefinitely.

  res.status(200).json({
    success: true,
    message: 'Thank you for your message. We will get back to you soon.',
  });
});

export default router;
