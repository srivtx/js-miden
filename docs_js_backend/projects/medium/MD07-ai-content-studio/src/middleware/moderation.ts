import type { Request, Response, NextFunction } from 'express';
import type { ModerationResult } from '../types.js';

// Simple keyword-based moderation as a stand-in for LLM moderation
const BLOCKED_PATTERNS = [
  /ignore previous instructions/i,
  /disregard all prior/i,
  /you are now a /i,
  /DAN mode/i,
  /jailbreak/i,
];

export async function moderatePrompt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const prompt = req.body?.prompt || '';
  const flagged = BLOCKED_PATTERNS.some((p) => p.test(prompt));
  const result: ModerationResult = {
    flagged,
    categories: flagged ? ['prompt_injection'] : [],
  };

  if (flagged) {
    res.status(400).json({ error: 'Content flagged by moderation', moderation: result });
    return;
  }

  res.locals.moderation = result;
  next();
}

// BUGGY: No moderation middleware - demonstrates prompt injection vulnerability
export function noModeration(req: Request, res: Response, next: NextFunction) {
  res.locals.moderation = { flagged: false, categories: [] };
  next();
}
