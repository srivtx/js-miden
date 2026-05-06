import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import { ContactRequest } from '../types.js';

export function validateContact(req: Request, res: Response, next: NextFunction): void {
  const { name, email, message, website } = req.body as ContactRequest;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    return;
  }

  if (!email || !validator.isEmail(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 5000) {
    res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
    return;
  }

  // Honeypot: if website field is filled, silently reject (bot detected)
  if (website && typeof website === 'string' && website.trim().length > 0) {
    res.status(200).json({ success: true, message: 'Message received' });
    return;
  }

  // Sanitize for logging (not storing in DB, but still good practice)
  (req as any).sanitizedBody = {
    name: validator.escape(name.trim()),
    email: validator.normalizeEmail(email.trim()) as string,
    message: validator.escape(message.trim()),
  };

  next();
}
